def split_file_into_four(file_path):
    file_size = os.path.getsize(file_path)
    chunk_size = file_size // 4  

    split_files = []
    with open(file_path, 'rb') as f:
        for part_number in range(1, 5):
            chunk = f.read(chunk_size)
            if not chunk:
                break
            part_path = f"{file_path}.part{part_number}"
            with open(part_path, 'wb') as part_file:
                part_file.write(chunk)
            split_files.append(part_path)
    
    return split_files
