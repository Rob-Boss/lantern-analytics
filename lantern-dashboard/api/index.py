import os
import sys

# Add the current folder to python path so 'main' can be resolved in any context
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app
