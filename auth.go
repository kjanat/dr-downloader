package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/playwright-community/playwright-go"
)

// RegistrationData represents the form data required for download
type RegistrationData struct {
	FirstName string `json:"firstname"`
	LastName  string `json:"lastname"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Country   string `json:"country"`
	State     string `json:"state"`
	City      string `json:"city"`
	Street    string `json:"street"`
	ZipCode   string `json:"zipcode"`
	Company   string `json:"company"`
	Product   string `json:"product"`
}

// DownloadResponse represents the response from registration endpoint
type DownloadResponse struct {
	DownloadURL string `json:"downloadUrl"`
	Success     bool   `json:"success"`
	Message     string `json:"message"`
}

// AuthenticatedDownloader handles Blackmagic Design's authentication
type AuthenticatedDownloader struct {
	Client    *http.Client
	BaseURL   string
	UserAgent string
}

// NewAuthenticatedDownloader creates a new authenticated downloader
func NewAuthenticatedDownloader() *AuthenticatedDownloader {
	return &AuthenticatedDownloader{
		Client: &http.Client{
			Timeout: 30 * 60 * 1000 * 1000 * 1000, // 30 minutes in nanoseconds
		},
		BaseURL:   "https://www.blackmagicdesign.com",
		UserAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	}
}

// GetAuthenticatedDownloadURL gets a signed download URL from Blackmagic Design using browser automation
func (ad *AuthenticatedDownloader) GetAuthenticatedDownloadURL(regData RegistrationData, productUUID string) (string, error) {
	// Use browser automation to properly simulate form submission
	fmt.Println("Starting browser automation for form submission...")

	// Determine the platform for the download button
	platform := "linux" // We're always downloading Linux version

	downloadURL, err := ad.automateFormSubmission(regData, platform)
	if err != nil {
		return "", fmt.Errorf("browser automation failed: %w", err)
	}

	if downloadURL == "" {
		return "", fmt.Errorf("no download URL captured from browser automation")
	}

	fmt.Printf("Successfully captured download URL: %s\n", downloadURL)
	return downloadURL, nil
}

// automateFormSubmission uses Playwright to fill and submit the Blackmagic Design form
func (ad *AuthenticatedDownloader) automateFormSubmission(regData RegistrationData, platform string) (string, error) {
	fmt.Println("Starting Playwright browser automation...")

	// Start Playwright
	pw, err := playwright.Run()
	if err != nil {
		return "", fmt.Errorf("could not start playwright: %w", err)
	}
	defer pw.Stop()

	// Launch browser with additional stability arguments
	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args: []string{
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
			"--disable-software-rasterizer",
			"--disable-background-timer-throttling",
			"--disable-backgrounding-occluded-windows",
			"--disable-renderer-backgrounding",
			"--disable-features=TranslateUI",
			"--disable-ipc-flooding-protection",
			"--single-process",
		},
	})
	if err != nil {
		return "", fmt.Errorf("could not launch browser: %w", err)
	}
	defer browser.Close()

	// Create new page
	page, err := browser.NewPage(playwright.BrowserNewPageOptions{
		UserAgent: playwright.String(ad.UserAgent),
	})
	if err != nil {
		return "", fmt.Errorf("could not create page: %w", err)
	}

	var downloadURL string

	// Set up response listener to capture download URL
	page.OnResponse(func(response playwright.Response) {
		url := response.URL()
		if strings.Contains(url, "swr.cloud.blackmagicdesign.com") && strings.Contains(url, "verify=") {
			downloadURL = url
			fmt.Printf("Captured download URL: %s\n", downloadURL)
		}
	})

	// Navigate to the download page
	fmt.Println("Navigating to download page...")
	_, err = page.Goto("https://www.blackmagicdesign.com/event/davinciresolvedownload", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(30000),
	})
	if err != nil {
		return "", fmt.Errorf("could not navigate to page: %w", err)
	}

	// Wait for the form to be visible
	_, err = page.WaitForSelector("form", playwright.PageWaitForSelectorOptions{
		Timeout: playwright.Float(10000),
	})
	if err != nil {
		return "", fmt.Errorf("could not find form: %w", err)
	}

	fmt.Println("Filling out form fields...")

	// Fill out the form fields
	err = page.Fill("#firstname", regData.FirstName)
	if err != nil {
		return "", fmt.Errorf("could not fill firstname: %w", err)
	}

	err = page.Fill("#lastname", regData.LastName)
	if err != nil {
		return "", fmt.Errorf("could not fill lastname: %w", err)
	}

	err = page.Fill("#email", regData.Email)
	if err != nil {
		return "", fmt.Errorf("could not fill email: %w", err)
	}

	err = page.Fill("#phone", regData.Phone)
	if err != nil {
		return "", fmt.Errorf("could not fill phone: %w", err)
	}

	err = page.Fill("#company", regData.Company)
	if err != nil {
		return "", fmt.Errorf("could not fill company: %w", err)
	}

	err = page.Fill("#street", regData.Street)
	if err != nil {
		return "", fmt.Errorf("could not fill street: %w", err)
	}

	err = page.Fill("#city", regData.City)
	if err != nil {
		return "", fmt.Errorf("could not fill city: %w", err)
	}

	err = page.Fill("#zip", regData.ZipCode)
	if err != nil {
		return "", fmt.Errorf("could not fill zip: %w", err)
	}

	// Country is already selected as "United States" by default, so skip country selection

	// Wait for state dropdown to be populated (it should already be ready)
	time.Sleep(1 * time.Second)

	// Select state
	_, err = page.SelectOption("#state", playwright.SelectOptionValues{Values: &[]string{regData.State}})
	if err != nil {
		return "", fmt.Errorf("could not select state: %w", err)
	}

	// Check the policy checkbox
	err = page.Check("#policy")
	if err != nil {
		return "", fmt.Errorf("could not check policy: %w", err)
	}

	fmt.Println("Form filled, waiting for download button...")

	// Wait for the download button to be visible and click it by text
	buttonText := fmt.Sprintf("Download %s", strings.Title(platform))
	if platform == "linux" {
		buttonText = "Download Linux"
	}

	fmt.Printf("Waiting for and clicking '%s' download button...\n", buttonText)
	err = page.Click(fmt.Sprintf("button:has-text('%s')", buttonText))
	if err != nil {
		return "", fmt.Errorf("could not click download button: %w", err)
	}

	// Wait for the download URL to be captured (max 30 seconds)
	attempts := 0
	for downloadURL == "" && attempts < 30 {
		time.Sleep(1 * time.Second)
		attempts++
	}

	if downloadURL == "" {
		return "", fmt.Errorf("failed to capture download URL after 30 seconds")
	}

	fmt.Printf("Successfully captured download URL: %s\n", downloadURL)
	return downloadURL, nil
}

// tryEndpoint attempts to submit form data to a specific endpoint
func (ad *AuthenticatedDownloader) tryEndpoint(endpoint string, formData url.Values, refererURL string, cookies []*http.Cookie) (string, error) {
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(formData.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers to mimic browser form submission
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", ad.UserAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Referer", refererURL)
	req.Header.Set("Origin", "https://www.blackmagicdesign.com")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	// Copy cookies from the page request to maintain session
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	// Submit the form
	resp, err := ad.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to submit form: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to close response body: %v\n", err)
			if err != nil {
				return
			}
		}
	}()

	// Read the response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	fmt.Printf("Response from %s (status %d): %s\n", endpoint, resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("request failed with status: %s, body: %s", resp.Status, string(body))
	}

	// Try to parse as JSON first
	var downloadResp DownloadResponse
	if err := json.Unmarshal(body, &downloadResp); err == nil {
		if !downloadResp.Success {
			return "", fmt.Errorf("registration failed: %s", downloadResp.Message)
		}
		if downloadResp.DownloadURL != "" {
			return downloadResp.DownloadURL, nil
		}
	}

	// If JSON parsing fails, search for download URL in response body
	bodyStr := string(body)

	// Look for download URL with verify parameter
	if strings.Contains(bodyStr, "swr.cloud.blackmagicdesign.com") {
		lines := strings.Split(bodyStr, "\n")
		for _, line := range lines {
			if strings.Contains(line, "swr.cloud.blackmagicdesign.com") && strings.Contains(line, "verify=") {
				if strings.Contains(line, "DaVinci_Resolve") {
					start := strings.Index(line, "https://swr.cloud.blackmagicdesign.com")
					if start != -1 {
						end := start
						for i := start; i < len(line); i++ {
							if line[i] == '"' || line[i] == ' ' || line[i] == '\n' || line[i] == '\r' {
								break
							}
							end = i + 1
						}
						if end > start {
							downloadURL := line[start:end]
							// Unescape any JSON escaping
							downloadURL = strings.ReplaceAll(downloadURL, "\\u0026", "&")
							return downloadURL, nil
						}
					}
				}
			}
		}
	}

	return "", fmt.Errorf("no download URL found in response")
}

// tryRegistration attempts to register a user at a specific endpoint
func (ad *AuthenticatedDownloader) tryRegistration(endpoint string, formData url.Values, refererURL string, cookies []*http.Cookie) (bool, error) {
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(formData.Encode()))
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers to mimic browser form submission
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", ad.UserAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Referer", refererURL)
	req.Header.Set("Origin", "https://www.blackmagicdesign.com")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	// Copy cookies from the page request to maintain session
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	// Submit the form
	resp, err := ad.Client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to submit form: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			_, err := fmt.Fprintf(os.Stderr, "Warning: failed to close response body: %v\n", err)
			if err != nil {
				return
			}
		}
	}()

	// Read the response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read response: %w", err)
	}

	fmt.Printf("Registration response from %s (status %d): %s\n", endpoint, resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("registration failed with status: %s, body: %s", resp.Status, string(body))
	}

	// Check if registration was successful
	// Try to parse as JSON first
	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err == nil {
		if success, ok := response["success"].(bool); ok && success {
			return true, nil
		}
		if message, ok := response["message"].(string); ok {
			return false, fmt.Errorf("registration failed: %s", message)
		}
	}

	// If we get here, assume registration was successful if status is 200
	return true, nil
}

// GetDefaultRegistrationData returns default registration data for testing
func GetDefaultRegistrationData() RegistrationData {
	return RegistrationData{
		FirstName: "John",
		LastName:  "Doe",
		Email:     "john.doe@example.com",
		Phone:     "555-123-4567",
		Country:   "United States",
		State:     "New York",
		City:      "New York",
		Street:    "123 Main St",
		ZipCode:   "10001",
		Company:   "",
		Product:   "DaVinci Resolve",
	}
}

// Product UUIDs for different DaVinci Resolve versions
const (
	DaVinciResolve202Linux = "2a6285afa62a422ab00e0a2117ebdf3c"
	DaVinciResolve201Linux = "b7128b5e9b0b4b8a9c4f1a2b3c4d5e6f" // Example - need to find actual UUID
)

// GetProductUUID returns the product UUID for a given version
func GetProductUUID(version string) (string, error) {
	switch version {
	case "20.2":
		return DaVinciResolve202Linux, nil
	case "20.1.1":
		return DaVinciResolve201Linux, nil
	default:
		return "", fmt.Errorf("unknown version: %s, supported versions: 20.2, 20.1.1", version)
	}
}
