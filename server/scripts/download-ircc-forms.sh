#!/bin/bash
# Download all IRCC fillable PDF forms from canada.ca and upload to the web application
# Usage: bash download-ircc-forms.sh

set -e

DOWNLOAD_DIR="/tmp/ircc-forms"
API_BASE="http://localhost:3001/api/ircc-templates"

mkdir -p "$DOWNLOAD_DIR"

echo "=== Downloading IRCC Form PDFs from canada.ca ==="

# Define all form URLs
declare -A FORM_URLS
FORM_URLS=(
  ["IMM 0008"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm0008/01-03-2025/imm0008e.pdf"
  ["IMM 0008 Schedule A"]="https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008_schedule_a.pdf"
  ["IMM 0008 Schedule 12"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm0008-sch12/01-11-2025/imm0008_12e.pdf"
  ["IMM 5669"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5669/01-05-2021/imm5669e.pdf"
  ["IMM 5406"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5406/01-04-2025/imm5406e.pdf"
  ["IMM 5562"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5562/01-07-2024/imm5562e.pdf"
  ["IMM 1294"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1294/01-10-2024/imm1294e.pdf"
  ["IMM 5645"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5645/01-01-2021/imm5645e.pdf"
  ["IMM 1295"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1295/01-09-2023/imm1295e.pdf"
  ["IMM 1344"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1344/01-09-2024/imm1344e.pdf"
  ["IMM 5532"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5532/01-02-2021/imm5532e.pdf"
  ["IMM 5257"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5257/01-09-2023/imm5257e.pdf"
  ["IMM 5768"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5768/01-07-2024/imm5768e.pdf"
  ["IMM 5476"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5476/01-11-2025/imm5476e.pdf"
  ["IMM 5444"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5444/01-09-2024/imm5444e.pdf"
  ["CIT 0002"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/cit0002/01-02-2026/cit0002e.pdf"
  ["CIT 0007"]="https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/cit0007/01-03-2024/cit0007e.pdf"
  ["EMP 5593"]="https://www.canada.ca/content/dam/esdc-edsc/documents/services/foreign-workers/form/emp5593.pdf"
  ["EMP 5575"]="https://catalogue.servicecanada.gc.ca/apps/EForms/pdf/en/ESDC-EMP5575.pdf"
)

# Form names for upload
declare -A FORM_NAMES
FORM_NAMES=(
  ["IMM 0008"]="Generic Application Form for Canada"
  ["IMM 0008 Schedule A"]="Background/Declaration"
  ["IMM 0008 Schedule 12"]="Additional Information — Refugee Claimant"
  ["IMM 5669"]="Schedule A – Declaration"
  ["IMM 5406"]="Additional Family Information"
  ["IMM 5562"]="Supplementary Information — Your Travels"
  ["IMM 1294"]="Application for a Study Permit"
  ["IMM 5645"]="Family Information"
  ["IMM 1295"]="Application for a Work Permit (PGWP)"
  ["IMM 1344"]="Application to Sponsor"
  ["IMM 5532"]="Relationship Information and Sponsorship Evaluation"
  ["IMM 5257"]="Application for Visitor Visa (TRV)"
  ["IMM 5768"]="Financial Evaluation for Parents and Grandparents Sponsorship"
  ["IMM 5476"]="Statutory Declaration of Common-Law Union"
  ["IMM 5444"]="Application for a Super Visa"
  ["CIT 0002"]="Application for Canadian Citizenship"
  ["CIT 0007"]="Application for Citizenship Certificate"
  ["EMP 5593"]="Labour Market Impact Assessment Application"
  ["EMP 5575"]="Schedule B – LMIA Application"
)

# Visa type for each form (first occurrence)
declare -A FORM_VISA
FORM_VISA=(
  ["IMM 0008"]="Express Entry"
  ["IMM 0008 Schedule A"]="Express Entry"
  ["IMM 0008 Schedule 12"]="Refugee Claim"
  ["IMM 5669"]="Express Entry"
  ["IMM 5406"]="Express Entry"
  ["IMM 5562"]="Express Entry"
  ["IMM 1294"]="Study Permit"
  ["IMM 5645"]="Study Permit"
  ["IMM 1295"]="Work Permit (PGWP)"
  ["IMM 1344"]="Spousal Sponsorship"
  ["IMM 5532"]="Spousal Sponsorship"
  ["IMM 5257"]="Visitor Visa (TRV)"
  ["IMM 5768"]="Parent/Grandparent Sponsorship"
  ["IMM 5476"]="Spousal Sponsorship"
  ["IMM 5444"]="Super Visa"
  ["CIT 0002"]="Citizenship Application"
  ["CIT 0007"]="Citizenship Application"
  ["EMP 5593"]="LMIA Application"
  ["EMP 5575"]="LMIA Application"
)

DOWNLOADED=0
FAILED=0
UPLOADED=0

# Download each form
for form_number in "${!FORM_URLS[@]}"; do
  url="${FORM_URLS[$form_number]}"
  safe_name=$(echo "$form_number" | tr ' ' '_')
  output_file="$DOWNLOAD_DIR/${safe_name}.pdf"

  echo ""
  echo "--- Downloading: $form_number ---"
  echo "    URL: $url"

  if curl -sS -L -o "$output_file" -w "HTTP %{http_code} | Size: %{size_download} bytes\n" "$url"; then
    # Check if file is valid (at least 1KB and starts with %PDF)
    file_size=$(wc -c < "$output_file" | tr -d ' ')
    if [ "$file_size" -gt 1024 ] && head -c 4 "$output_file" | grep -q '%PDF'; then
      echo "    ✓ Downloaded: ${file_size} bytes"
      DOWNLOADED=$((DOWNLOADED + 1))
    else
      echo "    ✗ Invalid PDF (size: ${file_size} bytes)"
      rm -f "$output_file"
      FAILED=$((FAILED + 1))
      continue
    fi
  else
    echo "    ✗ Download failed"
    FAILED=$((FAILED + 1))
    continue
  fi
done

echo ""
echo "=== Download Summary ==="
echo "Downloaded: $DOWNLOADED"
echo "Failed: $FAILED"
echo ""

echo "=== Uploading to Web Application ==="

for form_number in "${!FORM_URLS[@]}"; do
  safe_name=$(echo "$form_number" | tr ' ' '_')
  pdf_file="$DOWNLOAD_DIR/${safe_name}.pdf"

  if [ ! -f "$pdf_file" ]; then
    echo "--- Skipping $form_number (no PDF file) ---"
    continue
  fi

  form_name="${FORM_NAMES[$form_number]}"
  visa_type="${FORM_VISA[$form_number]}"
  encoded_form=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$form_number'))")

  echo "--- Uploading: $form_number ($form_name) ---"

  response=$(curl -sS -X POST \
    "${API_BASE}/${encoded_form}/upload" \
    -F "file=@${pdf_file};filename=${safe_name}.pdf" \
    -F "form_name=${form_name}" \
    -F "visa_type=${visa_type}" \
    -w "\nHTTP_CODE:%{http_code}")

  http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
  body=$(echo "$response" | grep -v "HTTP_CODE:")

  if [ "$http_code" = "200" ]; then
    echo "    ✓ Uploaded successfully"
    UPLOADED=$((UPLOADED + 1))
  else
    echo "    ✗ Upload failed (HTTP $http_code): $body"
  fi
done

echo ""
echo "=== Final Summary ==="
echo "PDFs Downloaded: $DOWNLOADED / ${#FORM_URLS[@]}"
echo "PDFs Uploaded:   $UPLOADED / $DOWNLOADED"
echo ""

# Cleanup
echo "Cleaning up temp files..."
rm -rf "$DOWNLOAD_DIR"
echo "Done!"
