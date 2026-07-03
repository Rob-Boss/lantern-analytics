import argparse
import sys
import yaml
from google_auth_oauthlib.flow import InstalledAppFlow

# The Google Ads API scope
SCOPES = ["https://www.googleapis.com/auth/adwords"]

def main(client_secrets_path=None, yaml_path=None):
    """Generates a Google Ads API OAuth2 refresh token."""
    print("Initializing OAuth2 flow...")
    try:
        if yaml_path:
            print(f"Reading credentials from {yaml_path}...")
            with open(yaml_path, "r") as f:
                config = yaml.safe_load(f)
            client_id = config.get("client_id")
            client_secret = config.get("client_secret")
            if not client_id or not client_secret or "INSERT" in client_id or "INSERT" in client_secret:
                print(
                    f"Error: client_id and client_secret must be set in {yaml_path}",
                    file=sys.stderr,
                )
                sys.exit(1)
            
            client_config = {
                "installed": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            }
            flow = InstalledAppFlow.from_client_config(
                client_config, scopes=SCOPES
            )
        elif client_secrets_path:
            print(f"Reading credentials from {client_secrets_path}...")
            flow = InstalledAppFlow.from_client_secrets_file(
                client_secrets_path, scopes=SCOPES
            )
        else:
            print("Error: Either --secrets or --yaml must be provided.", file=sys.stderr)
            sys.exit(1)
        
        # Runs a local web server to complete the authorization flow
        # Ensure you add http://localhost:8080 (or the port selected) to Authorized Redirect URIs
        creds = flow.run_local_server(port=0)
        
        print("\n" + "="*50)
        print("AUTHENTICATION SUCCESSFUL!")
        print("="*50)
        print(f"Client ID:      {creds.client_id}")
        print(f"Client Secret:  {creds.client_secret}")
        print(f"Refresh Token:  {creds.refresh_token}")
        print("="*50)
        print("\nNext step: Copy the values above into your 'google-ads.yaml' file.")
        
    except Exception as e:
        print(f"Error occurred during authentication flow: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generates Google Ads API OAuth2 credentials."
    )
    parser.add_argument(
        "--secrets",
        help="Path to your client_secrets.json downloaded from Google Cloud Console.",
    )
    parser.add_argument(
        "--yaml",
        default="google-ads.yaml",
        help="Path to your google-ads.yaml configuration file.",
    )
    args = parser.parse_args()
    
    # If --secrets is explicitly provided, use it. Otherwise, default to using --yaml.
    if args.secrets:
        main(client_secrets_path=args.secrets)
    else:
        main(yaml_path=args.yaml)
