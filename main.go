package main

import (
	"bufio"
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
	// DefaultDownloadURL - Official DaVinci Resolve download URLs
	// These need to be updated when new versions are released
	DefaultDownloadURL = "https://swr.cloud.blackmagicdesign.com/DaVinciResolve/v20.2/DaVinci_Resolve_20.2_Linux.zip"
	DefaultFilename    = "DaVinci_Resolve_20.2_Linux.zip"

	// ExpectedChecksum - Expected SHA256 checksum (update this with actual checksum)
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
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to close file: %v\n", err)
			if err != nil {
				return
			}
		}
	}()

	// Make the request
	resp, err := d.Client.Get(d.URL)
	if err != nil {
		if err := os.Remove(d.Destination + ".tmp"); err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to remove temp file: %v\n", err)
			if err != nil {
				return err
			}
		}
		return fmt.Errorf("failed to download: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to close response body: %v\n", err)
			if err != nil {
				return
			}
		}
	}()

	if resp.StatusCode != http.StatusOK {
		if err := os.Remove(d.Destination + ".tmp"); err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to remove temp file: %v\n", err)
			if err != nil {
				return err
			}
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
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to remove temp file: %v\n", err)
			if err != nil {
				return err
			}
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
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to close file: %v\n", err)
			if err != nil {
				return
			}
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

// getRegistrationData validates and prompts for missing registration data
func getRegistrationData(firstName, lastName, email, phone, country, state, city, street, zipcode, company string) (RegistrationData, error) {
	scanner := bufio.NewScanner(os.Stdin)

	// Helper function to prompt for input if empty
	promptIfEmpty := func(value, prompt string) string {
		if value != "" {
			return value
		}
		fmt.Printf("%s: ", prompt)
		if scanner.Scan() {
			return strings.TrimSpace(scanner.Text())
		}
		return ""
	}

	// Validate and prompt for required fields
	firstName = promptIfEmpty(firstName, "First name")
	if firstName == "" {
		return RegistrationData{}, fmt.Errorf("first name is required")
	}

	lastName = promptIfEmpty(lastName, "Last name")
	if lastName == "" {
		return RegistrationData{}, fmt.Errorf("last name is required")
	}

	email = promptIfEmpty(email, "Email address")
	if email == "" || !strings.Contains(email, "@") {
		return RegistrationData{}, fmt.Errorf("valid email address is required")
	}

	phone = promptIfEmpty(phone, "Phone number")
	if phone == "" {
		return RegistrationData{}, fmt.Errorf("phone number is required")
	}

	country = promptIfEmpty(country, "Country")
	if country == "" {
		return RegistrationData{}, fmt.Errorf("country is required")
	}

	state = promptIfEmpty(state, "State/Province")
	if state == "" {
		return RegistrationData{}, fmt.Errorf("state/province is required")
	}

	city = promptIfEmpty(city, "City")
	if city == "" {
		return RegistrationData{}, fmt.Errorf("city is required")
	}

	street = promptIfEmpty(street, "Street address")
	if street == "" {
		return RegistrationData{}, fmt.Errorf("street address is required")
	}

	zipcode = promptIfEmpty(zipcode, "ZIP/Postal code")
	if zipcode == "" {
		return RegistrationData{}, fmt.Errorf("ZIP/postal code is required")
	}

	// Company is optional
	company = promptIfEmpty(company, "Company (optional, press Enter to skip)")

	return RegistrationData{
		FirstName: firstName,
		LastName:  lastName,
		Email:     email,
		Phone:     phone,
		Country:   country,
		State:     state,
		City:      city,
		Street:    street,
		ZipCode:   zipcode,
		Company:   company,
	}, nil
}

func main() {
	var (
		url      = flag.String("url", "", "Download URL (if empty, will authenticate with Blackmagic Design)")
		output   = flag.String("output", "", "Output file path")
		verify   = flag.Bool("verify", false, "Verify checksum after download")
		checksum = flag.String("checksum", ExpectedChecksum, "Expected SHA256 checksum")
		aurCache = flag.String("aur-cache", "", "AUR cache directory (auto-detect if not specified)")
		force    = flag.Bool("force", false, "Force redownload even if file exists")
		version  = flag.String("version", "20.2", "DaVinci Resolve version")

		// Authentication parameters - require real data for reliability
		firstName = flag.String("firstname", "", "First name for registration (required)")
		lastName  = flag.String("lastname", "", "Last name for registration (required)")
		email     = flag.String("email", "", "Email for registration (required)")
		phone     = flag.String("phone", "", "Phone for registration (required)")
		country   = flag.String("country", "", "Country for registration (required)")
		state     = flag.String("state", "", "State for registration (required)")
		city      = flag.String("city", "", "City for registration (required)")
		street    = flag.String("street", "", "Street address for registration (required)")
		zipcode   = flag.String("zipcode", "", "ZIP code for registration (required)")
		company   = flag.String("company", "", "Company name for registration (optional)")
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
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to remove existing file: %v\n", err)
			if err != nil {
				return
			}
		}
	}

	// Determine download URL
	downloadURL := *url

	// If no URL provided, use authentication to get signed URL
	if downloadURL == "" {
		fmt.Println("No URL provided, using authentication to get download URL...")

		// Validate and collect registration data
		regData, err := getRegistrationData(*firstName, *lastName, *email, *phone, *country, *state, *city, *street, *zipcode, *company)
		if err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Registration data error: %v\n", err)
			if err != nil {
				return
			}
			os.Exit(1)
		}

		// Get product UUID for version
		productUUID, err := GetProductUUID(*version)
		if err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Unsupported version: %v\n", err)
			if err != nil {
				return
			}
			os.Exit(1)
		}

		// Get authenticated download URL
		authDownloader := NewAuthenticatedDownloader()
		authURL, err := authDownloader.GetAuthenticatedDownloadURL(regData, productUUID)
		if err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Authentication failed: %v\n", err)
			if err != nil {
				return
			}
			os.Exit(1)
		}

		downloadURL = authURL
		fmt.Printf("✓ Authentication successful, got download URL\n")
	} else {
		// Update URL if version is different and URL was provided
		if *version != "20.2" {
			downloadURL = fmt.Sprintf("https://swr.cloud.blackmagicdesign.com/DaVinciResolve/v%s/DaVinci_Resolve_%s_Linux.zip", *version, *version)
		}
	}

	// Update destination filename for different versions
	if *version != "20.2" {
		destination = strings.ReplaceAll(destination, "20.2", *version)
	}

	downloader := NewDownloader(downloadURL, destination, *verify, *checksum)

	if err := downloader.Download(); err != nil {
		_, err := fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		if err != nil {
			return
		}
		os.Exit(1)
	}

	fmt.Printf("\nFile saved to: %s\n", destination)
	fmt.Println("\nYou can now run 'yay -Syu davinci-resolve' again")
	fmt.Println("The AUR package should find the downloaded file automatically")
}
