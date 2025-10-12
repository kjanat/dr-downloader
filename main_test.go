package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewDownloader(t *testing.T) {
	downloader := NewDownloader("https://example.com/file.zip", "/tmp/file.zip", true, "abc123")

	if downloader.URL != "https://example.com/file.zip" {
		t.Errorf("URL = %v, want %v", downloader.URL, "https://example.com/file.zip")
	}
	if downloader.Destination != "/tmp/file.zip" {
		t.Errorf("Destination = %v, want %v", downloader.Destination, "/tmp/file.zip")
	}
	if !downloader.Verify {
		t.Error("Verify should be true")
	}
	if downloader.Checksum != "abc123" {
		t.Errorf("Checksum = %v, want %v", downloader.Checksum, "abc123")
	}
	if downloader.Client == nil {
		t.Error("Client should not be nil")
	}
}

func TestDownloader_Download(t *testing.T) {
	testContent := "This is test file content"
	hash := sha256.Sum256([]byte(testContent))
	expectedChecksum := hex.EncodeToString(hash[:])

	tests := []struct {
		name           string
		setupServer    func() *httptest.Server
		verify         bool
		checksum       string
		wantErr        bool
		wantErrContain string
	}{
		{
			name: "successful download",
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Length", fmt.Sprintf("%d", len(testContent)))
					w.WriteHeader(http.StatusOK)
					if _, err := fmt.Fprint(w, testContent); err != nil {
						t.Errorf("Failed to write test content: %v", err)
					}
				}))
			},
			verify:   true,
			checksum: expectedChecksum,
			wantErr:  false,
		},
		{
			name: "server returns 404",
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusNotFound)
					if _, err := fmt.Fprint(w, "Not Found"); err != nil {
						t.Errorf("Failed to write error response: %v", err)
					}
				}))
			},
			wantErr:        true,
			wantErrContain: "bad status",
		},
		{
			name: "checksum mismatch",
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Length", fmt.Sprintf("%d", len(testContent)))
					w.WriteHeader(http.StatusOK)
					if _, err := fmt.Fprint(w, testContent); err != nil {
						t.Errorf("Failed to write test content: %v", err)
					}
				}))
			},
			verify:         true,
			checksum:       "invalid_checksum",
			wantErr:        true,
			wantErrContain: "checksum verification failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			dest := filepath.Join(tmpDir, "test_file.zip")

			server := tt.setupServer()
			defer server.Close()

			downloader := NewDownloader(server.URL, dest, tt.verify, tt.checksum)
			err := downloader.Download()

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error, got nil")
				} else if tt.wantErrContain != "" && !strings.Contains(err.Error(), tt.wantErrContain) {
					t.Errorf("Error = %v, want error containing %v", err, tt.wantErrContain)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}

				// Verify file was created
				if _, err := os.Stat(dest); os.IsNotExist(err) {
					t.Error("Downloaded file does not exist")
				}
			}
		})
	}
}

func TestGetRegistrationData(t *testing.T) {
	// Test with all flags provided
	data, err := getRegistrationData("John", "Doe", "john@example.com", "555-1234", "US", "CA", "SF", "123 Main St", "94102", "Company")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if data.FirstName != "John" {
		t.Errorf("FirstName = %v, want John", data.FirstName)
	}
	if data.Email != "john@example.com" {
		t.Errorf("Email = %v, want john@example.com", data.Email)
	}
}

func TestAuthenticatedDownloader(t *testing.T) {
	// Mock auth server
	authServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		response := DownloadResponse{
			DownloadURL: "https://example.com/test.zip",
			Success:     true,
			Message:     "Success",
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer authServer.Close()

	downloader := NewAuthenticatedDownloader()
	downloader.BaseURL = authServer.URL

	regData := GetDefaultRegistrationData()
	url, err := downloader.GetAuthenticatedDownloadURL(regData, "test-uuid")

	if err != nil {
		t.Fatalf("Authentication failed: %v", err)
	}

	if url != "https://example.com/test.zip" {
		t.Errorf("URL = %v, want https://example.com/test.zip", url)
	}
}

// Integration test - complete workflow
func TestFullWorkflow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testContent := "DaVinci Resolve test content"
	hash := sha256.Sum256([]byte(testContent))
	expectedChecksum := hex.EncodeToString(hash[:])

	// Mock download server
	downloadServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(testContent)))
		w.Header().Set("Content-Type", "application/zip")
		w.WriteHeader(http.StatusOK)
		if _, err := fmt.Fprint(w, testContent); err != nil {
			t.Errorf("Failed to write test content: %v", err)
		}
	}))
	defer downloadServer.Close()

	// Mock auth server
	authServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		response := DownloadResponse{
			DownloadURL: downloadServer.URL + "/DaVinci_Resolve_Test.zip",
			Success:     true,
			Message:     "Success",
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer authServer.Close()

	tmpDir := t.TempDir()
	destination := filepath.Join(tmpDir, "davinci.zip")

	// Test authentication
	authDownloader := NewAuthenticatedDownloader()
	authDownloader.BaseURL = authServer.URL

	regData := GetDefaultRegistrationData()
	downloadURL, err := authDownloader.GetAuthenticatedDownloadURL(regData, "test-uuid")
	if err != nil {
		t.Fatalf("Authentication failed: %v", err)
	}

	// Test download
	downloader := NewDownloader(downloadURL, destination, true, expectedChecksum)
	err = downloader.Download()
	if err != nil {
		t.Fatalf("Download failed: %v", err)
	}

	// Verify result
	content, err := os.ReadFile(destination)
	if err != nil {
		t.Fatalf("Failed to read downloaded file: %v", err)
	}

	if string(content) != testContent {
		t.Errorf("Content mismatch: got %s, want %s", string(content), testContent)
	}
}

// Benchmark for basic performance testing
func BenchmarkDownload(b *testing.B) {
	testContent := strings.Repeat("test", 1000) // 4KB

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(testContent)))
		w.WriteHeader(http.StatusOK)
		if _, err := fmt.Fprint(w, testContent); err != nil {
			b.Errorf("Failed to write test content: %v", err)
		}
	}))
	defer server.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tmpDir := b.TempDir()
		dest := filepath.Join(tmpDir, fmt.Sprintf("bench_%d.zip", i))

		downloader := NewDownloader(server.URL, dest, false, "")
		if err := downloader.Download(); err != nil {
			b.Fatalf("Download failed: %v", err)
		}
	}
}
