import pandas as pd
import joblib
import pickle
import os
from pymongo import MongoClient
from bson import ObjectId

# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'model')
DATA_DIR = os.path.join(BASE_DIR, 'data')

SCALER_PATH = os.path.join(MODEL_DIR, 'scaler.pkl')
MODEL_PATH = os.path.join(MODEL_DIR, 'kmeans_model.pkl')

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "customer_segmentation")

if not MONGODB_URI:
    print("Warning: MONGODB_URI NOT found in environment! Running in MOCK mode with mongomock.")
    import mongomock
    client = mongomock.MongoClient()
else:
    print(f"Connecting to MongoDB Atlas: {MONGODB_URI.split('@')[-1]}")
    client = MongoClient(MONGODB_URI)

db = client[DB_NAME]
print(f"Using database: {DB_NAME}")
customers_col = db["customers"]
predictions_col = db["predictions"]
deleted_col = db["deleted"]

# Cluster Mapping
CLUSTER_LABELS = {
    0: "Deal-Seeking Parents",
    1: "Budget-Conscious",
    2: "High-Value",
    3: "Premium Loyal"
}

def load_pkl(path):
    try:
        return joblib.load(path)
    except Exception:
        with open(path, 'rb') as f:
            return pickle.load(f)

# Load Models
scaler = load_pkl(SCALER_PATH)
model = load_pkl(MODEL_PATH)

def get_cluster_label(cluster_id):
    return CLUSTER_LABELS.get(cluster_id, "Unknown Segment")

def preprocess_and_predict(input_data: dict) -> tuple:
    # Feature columns expected by scaler
    df = pd.DataFrame([{
        'Education': getattr(input_data, 'Education', 0),
        'Marital_Status': getattr(input_data, 'Marital_Status', 0),
        'Income': input_data.Income,
        'Recency': input_data.Recency,
        'NumDealsPurchases': input_data.NumDealsPurchases,
        'NumWebVisitsMonth': input_data.NumWebVisitsMonth,
        'Response': getattr(input_data, 'Response', 0),
        'Age': input_data.Age,
        'Total_Spend': input_data.Total_Spend,
        'Total_Purchases': input_data.Total_Purchases,
        'Total_Dependents': input_data.Total_Dependents,
        'Total_Campaigns_Accepted': input_data.Total_Campaigns_Accepted
    }])
    
    scaled_data = scaler.transform(df)
    cluster = int(model.predict(scaled_data)[0])
    label = get_cluster_label(cluster)
    
    return cluster, label

def save_prediction(input_data: dict, cluster: int, label: str):
    # Prepare row
    row = {
        'Education': getattr(input_data, 'Education', 0),
        'Marital_Status': getattr(input_data, 'Marital_Status', 0),
        'Income': input_data.Income,
        'Recency': input_data.Recency,
        'NumDealsPurchases': input_data.NumDealsPurchases,
        'NumWebVisitsMonth': input_data.NumWebVisitsMonth,
        'Response': getattr(input_data, 'Response', 0),
        'Age': input_data.Age,
        'Total_Spend': input_data.Total_Spend,
        'Total_Purchases': input_data.Total_Purchases,
        'Total_Dependents': input_data.Total_Dependents,
        'Total_Campaigns_Accepted': input_data.Total_Campaigns_Accepted,
        'Cluster': cluster,
        'Cluster_Label': label
    }
    
    # Store in predictions collection
    predictions_col.insert_one(row.copy())
    # Store in customers collection (if you want to track them separately)
    customers_col.insert_one(row)
        
def get_dashboard_stats():
    try:
        total_customers = customers_col.count_documents({})
        if total_customers == 0:
            return {}

        pipeline = [
            {
                "$group": {
                    "_id": "$Cluster_Label",
                    "count": {"$sum": 1},
                    "avgIncome": {"$avg": "$Income"},
                    "avgSpend": {"$avg": "$Total_Spend"}
                }
            }
        ]
        
        results = list(customers_col.aggregate(pipeline))
        
        segment_distribution = {res["_id"]: res["count"] for res in results}
        avg_income_per_segment = {res["_id"]: round(res.get("avgIncome", 0), 0) for res in results}
        avg_spend_per_segment = {res["_id"]: round(res.get("avgSpend", 0), 0) for res in results}
        
        # Global Averages
        avg_global = list(customers_col.aggregate([
            {"$group": {"_id": None, "avgIncome": {"$avg": "$Income"}, "avgSpend": {"$avg": "$Total_Spend"}}}
        ]))
        
        avg_income = round(avg_global[0]["avgIncome"], 0) if avg_global else 0
        avg_spend = round(avg_global[0]["avgSpend"], 0) if avg_global else 0
        
        return {
            "total_customers": total_customers,
            "segments": len(segment_distribution),
            "avg_income": avg_income,
            "avg_spend": avg_spend,
            "segment_distribution": segment_distribution,
            "avg_income_per_segment": avg_income_per_segment,
            "avg_spend_per_segment": avg_spend_per_segment
        }
    except Exception as e:
        print("Error in stats:", e)
        return {}

def get_customers_data():
    try:
        docs = list(customers_col.find().sort("_id", -1))
        for doc in docs:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
        return docs
    except Exception:
        return []

def get_predictions_data():
    try:
        docs = list(predictions_col.find().sort("_id", -1))
        for doc in docs:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
        return docs
    except Exception:
        return []

def delete_customer(customer_id: str):
    try:
        obj_id = ObjectId(customer_id)
        # Find customer
        customer = customers_col.find_one({"_id": obj_id})
        if not customer:
            return False, "Customer not found"
        
        # Move to deleted collection
        deleted_col.insert_one(customer)
        # Remove from main collection
        customers_col.delete_one({"_id": obj_id})
            
        return True, "Customer deleted successfully"
    except Exception as e:
        return False, str(e)

