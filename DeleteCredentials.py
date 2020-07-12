import os

if os.path.exists("credentials.pkl") and input("Delete Credentials? [y/n] :\t") == 'y':
    os.remove("credentials.pkl")

# Find The Credentials File and Delete it
