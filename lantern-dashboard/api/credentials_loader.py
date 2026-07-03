import os
import tempfile

_ga4_creds_path = None
_meta_creds_path = None
_google_ads_yaml_path = None

def get_ga4_creds_path(base_dir):
    global _ga4_creds_path
    if _ga4_creds_path:
        return _ga4_creds_path
        
    env_val = os.environ.get("GA4_CREDS_JSON")
    if env_val:
        temp_path = os.path.join(tempfile.gettempdir(), "ga4-credentials.json")
        with open(temp_path, "w") as f:
            f.write(env_val)
        _ga4_creds_path = temp_path
        return temp_path
    return os.path.join(base_dir, "ga4-credentials.json")

def get_meta_creds_path(base_dir):
    global _meta_creds_path
    if _meta_creds_path:
        return _meta_creds_path
        
    env_val = os.environ.get("META_CREDS_JSON")
    if env_val:
        temp_path = os.path.join(tempfile.gettempdir(), "meta-credentials.json")
        with open(temp_path, "w") as f:
            f.write(env_val)
        _meta_creds_path = temp_path
        return temp_path
    return os.path.join(base_dir, "meta-credentials.json")

def get_google_ads_yaml_path(base_dir):
    global _google_ads_yaml_path
    if _google_ads_yaml_path:
        return _google_ads_yaml_path
        
    env_val = os.environ.get("GOOGLE_ADS_YAML")
    if env_val:
        temp_path = os.path.join(tempfile.gettempdir(), "google-ads.yaml")
        with open(temp_path, "w") as f:
            f.write(env_val)
        _google_ads_yaml_path = temp_path
        return temp_path
    return os.path.join(base_dir, "google-ads.yaml")
