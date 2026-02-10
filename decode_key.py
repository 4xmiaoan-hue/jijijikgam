
import base64
import json

key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdHZ4bWhxc29sYW1tem5iY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTMyNDksImV4cCI6MjA4MzM2OTI0OX0.V7LY6oqG1HrVcXDREjSWTNKbAGYAlXJdKxW6fRxAEcc"
payload = key.split('.')[1]
# Add padding
payload += '=' * (4 - len(payload) % 4)
decoded = base64.b64decode(payload).decode('utf-8')
print(json.dumps(json.loads(decoded), indent=2))
