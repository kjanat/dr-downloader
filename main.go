package main

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	// Official DaVinci Resolve download URLs
	// These need to be updated when new versions are released
	DefaultDownloadURL = "https://swr.cloud.blackmagicdesign.com/DaVinciResolve/v20.2/DaVinci_Resolve_20.2_Linux.zip"
	DefaultFilename    = "DaVinci_Resolve_20.2_Linux.zip"

	// Expected SHA256 checksum (update this with actual checksum)
	ExpectedChecksum = "" // Will be populated once we have the official checksum
)

type Downloader struct {
	URL         string
	Destination string
	Verify      bool
	Checksum    string
	Client      *http.Client
}

func NewDownloader(url, dest string, verify bool, checksum string) *Downloader {
	return &Downloader{
		URL:         url,
		Destination: dest,
		Verify:      verify,
		Checksum:    checksum,
		Client: &http.Client{
			Timeout: 30 * time.Minute, // Large file, long timeout
		},
	}
}

func (d *Downloader) Download() error {
	// Create output directory if it doesn't exist
	dir := filepath.Dir(d.Destination)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Check if file already exists
	if _, err := os.Stat(d.Destination); err == nil {
		fmt.Printf("File already exists: %s\n", d.Destination)

		if d.Verify && d.Checksum != "" {
			fmt.Println("Verifying existing file...")
			if err := d.verifyChecksum(); err != nil {
				fmt.Printf("Checksum verification failed: %v\n", err)
				fmt.Println("Redownloading file...")
			} else {
				fmt.Println("✓ Existing file checksum verified successfully")
				return nil
			}
		} else {
			fmt.Println("Use --force to redownload or --verify to check integrity")
			return nil
		}
	}

	fmt.Printf("Downloading from: %s\n", d.URL)
	fmt.Printf("Destination: %s\n", d.Destination)

	// Create the file
	out, err := os.Create(d.Destination + ".tmp")
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer func() {
		if err := out.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to close file: %v\n", err)
		}
	}()

	// Make the request
	resp, err := d.Client.Get(d.URL)
	if err != nil {
		if err := os.Remove(d.Destination + ".tmp"); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to remove temp file: %v\n", err)
		}
		return fmt.Errorf("failed to download: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to close response body: %v\n", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		if err := os.Remove(d.Destination + ".tmp"); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to remove temp file: %v\n", err)
		}
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	// Get the size
	size := resp.ContentLength
	fmt.Printf("File size: %.2f MB\n", float64(size)/1024/1024)

	// Create progress reporter
	progress := &ProgressWriter{
		Total:  size,
		Writer: out,
	}

	// Copy with progress
	_, err = io.Copy(progress, resp.Body)
	if err != nil {
		if err := os.Remove(d.Destination + ".tmp"); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to remove temp file: %v\n", err)
		}
		return fmt.Errorf("failed to save file: %w", err)
	}

	fmt.Println() // New line after progress

	// Close the file before renaming
	if err := out.Close(); err != nil {
		return fmt.Errorf("failed to close file: %w", err)
	}

	// Rename temp file to final destination
	if err := os.Rename(d.Destination+".tmp", d.Destination); err != nil {
		return fmt.Errorf("failed to rename file: %w", err)
	}

	fmt.Println("✓ Download completed successfully")

	// Verify checksum if requested
	if d.Verify && d.Checksum != "" {
		fmt.Println("Verifying checksum...")
		if err := d.verifyChecksum(); err != nil {
			return fmt.Errorf("checksum verification failed: %w", err)
		}
		fmt.Println("✓ Checksum verified successfully")
	}

	return nil
}

func (d *Downloader) verifyChecksum() error {
	file, err := os.Open(d.Destination)
	if err != nil {
		return err
	}
	defer func() {
		if err := file.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to close file: %v\n", err)
		}
	}()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}

	checksum := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(checksum, d.Checksum) {
		return fmt.Errorf("checksum mismatch: got %s, expected %s", checksum, d.Checksum)
	}

	return nil
}

// ProgressWriter tracks download progress
type ProgressWriter struct {
	Total      int64
	Downloaded int64
	Writer     io.Writer
}

func (p *ProgressWriter) Write(b []byte) (int, error) {
	n, err := p.Writer.Write(b)
	p.Downloaded += int64(n)
	p.printProgress()
	return n, err
}

func (p *ProgressWriter) printProgress() {
	if p.Total == 0 {
		return
	}

	percent := float64(p.Downloaded) / float64(p.Total) * 100
	downloaded := float64(p.Downloaded) / 1024 / 1024
	total := float64(p.Total) / 1024 / 1024

	fmt.Printf("\rProgress: %.2f%% (%.2f MB / %.2f MB)", percent, downloaded, total)
}

func main() {
	var (
		url      = flag.String("url", DefaultDownloadURL, "Download URL")
		output   = flag.String("output", "", "Output file path")
		verify   = flag.Bool("verify", false, "Verify checksum after download")
		checksum = flag.String("checksum", ExpectedChecksum, "Expected SHA256 checksum")
		aurCache = flag.String("aur-cache", "", "AUR cache directory (auto-detect if not specified)")
		force    = flag.Bool("force", false, "Force redownload even if file exists")
		version  = flag.String("version", "20.2", "DaVinci Resolve version")
	)

	flag.Parse()

	// Determine output path
	destination := *output
	if destination == "" {
		if *aurCache != "" {
			// Use AUR cache directory
			destination = filepath.Join(*aurCache, DefaultFilename)
		} else {
			// Try to auto-detect AUR cache directory
			homeDir, err := os.UserHomeDir()
			if err == nil {
				// Check common AUR cache locations
				aurPaths := []string{
					filepath.Join(homeDir, ".cache", "yay", "davinci-resolve"),
					filepath.Join(homeDir, ".cache", "paru", "davinci-resolve"),
					filepath.Join(homeDir, ".cache", "aurutils", "davinci-resolve"),
				}

				for _, path := range aurPaths {
					if info, err := os.Stat(path); err == nil && info.IsDir() {
						destination = filepath.Join(path, DefaultFilename)
						fmt.Printf("Auto-detected AUR cache: %s\n", path)
						break
					}
				}
			}

			// Fallback to current directory
			if destination == "" {
				destination = DefaultFilename
			}
		}
	}

	// Handle force flag
	if *force {
		if err := os.Remove(destination); err != nil && !os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "Warning: failed to remove existing file: %v\n", err)
		}
	}

	// Update URL if version is different
	if *version != "20.2" {
		*url = fmt.Sprintf("https://swr.cloud.blackmagicdesign.com/DaVinciResolve/v%s/DaVinci_Resolve_%s_Linux.zip", *version, *version)
		destination = strings.ReplaceAll(destination, "20.2", *version)
	}

	downloader := NewDownloader(*url, destination, *verify, *checksum)

	if err := downloader.Download(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nFile saved to: %s\n", destination)
	fmt.Println("\nYou can now run 'yay -Syu davinci-resolve' again")
	fmt.Println("The AUR package should find the downloaded file automatically")
}
