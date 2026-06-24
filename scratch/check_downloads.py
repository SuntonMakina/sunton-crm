import os

def list_dir_recursive(path, depth=0):
    if not os.path.exists(path):
        print(f"Path does not exist: {path}")
        return
    print("  " * depth + f"[{path}]")
    try:
        for item in os.listdir(path):
            full_path = os.path.join(path, item)
            if os.path.isdir(full_path):
                # Don't go too deep or list system dirs
                if not item.startswith('.') and depth < 3:
                    list_dir_recursive(full_path, depth + 1)
            else:
                size_kb = os.path.getsize(full_path) / 1024
                print("  " * (depth + 1) + f"{item} ({size_kb:.2f} KB)")
    except Exception as e:
        print("  " * (depth + 1) + f"Error listing: {e}")

print("Checking Downloads folder:")
list_dir_recursive('/Users/berkhan/Downloads')
