import os
import time

def run():
    now = time.time()
    one_day_ago = now - 24 * 3600
    
    print("Files modified in the last 24 hours:")
    for root, dirs, files in os.walk("."):
        # Skip node_modules, .next, .git
        if any(p in root for p in ["node_modules", ".next", ".git", "whatsapp-session"]):
            continue
            
        for file in files:
            filepath = os.path.join(root, file)
            try:
                mtime = os.path.getmtime(filepath)
                if mtime > one_day_ago:
                    readable_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
                    print(f"- {filepath} ({readable_time})")
            except OSError:
                pass

if __name__ == "__main__":
    run()
