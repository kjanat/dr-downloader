# Docker Usage Guide

This guide explains how to run the DaVinci Resolve daVinciDownloader using Docker.

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Default download to `./downloads` directory:**

   ```bash
   docker compose up --build
   ```

2. **Custom output directory:**

   ```bash
   OUTPUT_DIR=/path/to/your/downloads docker compose up --build
   ```

3. **With custom arguments (e.g., test mode):**

   ```bash
   EXTRA_ARGS="--test" docker compose up --build
   ```

### Option 2: Direct Docker Run

1. **Build the image:**

   ```bash
   docker build -t dr-daVinciDownloader .
   ```

2. **Run with volume mount:**

   ```bash
   docker run -it --init --cap-add=SYS_ADMIN --rm \
     -v /path/to/your/downloads:/app/downloads \
     dr-daVinciDownloader
   ```

3. **Run in test mode:**

   ```bash
   docker run -it --init --cap-add=SYS_ADMIN --rm \
     -v /path/to/your/downloads:/app/downloads \
     dr-daVinciDownloader --test
   ```

## Configuration

### Environment Variables

- `DEFAULT_OUTPUT_PATH`: Override default output path inside container (default: `/app/downloads`)

### Volume Mounts

The container exposes `/app/downloads` as a volume mount point. Mount your local directory to this path to receive the downloaded files.

### Required Docker Flags

- `--init`: Process management (required for Puppeteer)
- `--cap-add=SYS_ADMIN`: Required for Chrome sandbox mode
- `--rm`: Remove container after completion (optional but recommended)

## Examples

### Download to current directory

```bash
docker run -it --init --cap-add=SYS_ADMIN --rm \
  -v $(pwd):/app/downloads \
  dr-daVinciDownloader
```

### Download to specific directory

```bash
docker run -it --init --cap-add=SYS_ADMIN --rm \
  -v /home/user/Downloads:/app/downloads \
  dr-daVinciDownloader
```

### Test mode (faster, doesn't actually download)

```bash
docker run -it --init --cap-add=SYS_ADMIN --rm \
  -v $(pwd):/app/downloads \
  dr-daVinciDownloader --test
```

### Using docker-compose with custom directory

```bash
OUTPUT_DIR=/home/user/Downloads docker compose up --build
```

## Notes

- The downloaded file will be saved as a `.zip` file in your specified output directory
- The container will automatically remove itself after completion when using `--rm`
- Make sure your output directory has sufficient free space (~3.5GB)
- The application uses test registration data by default - no real personal information is submitted

## Troubleshooting

### Permission Issues

If you encounter permission issues with the downloaded file, you may need to adjust ownership:

```bash
sudo chown $USER:$USER /path/to/downloaded/file.zip
```

### Container Exits Immediately

Make sure you're using the required Docker flags (`--init` and `--cap-add=SYS_ADMIN`).

### Chrome/Puppeteer Issues

The image uses the official Puppeteer Docker image which includes Chrome for Testing. If you encounter browser issues, try updating to the latest image:

```bash
docker pull ghcr.io/puppeteer/puppeteer:latest
docker build --no-cache -t dr-daVinciDownloader .
```
