# This script removes leaked credential files from your entire Git history.
# It uses git filter-branch to rewrite history and prune the sensitive files.

$filesToRemove = @(
    "qa_dashboard_auth.js",
    "qa_dashboard.js",
    "qa_login.js",
    "qa_reg.js",
    "qa_script.js",
    "generate_magic_link.js"
)

$fileList = $filesToRemove -join " "

Write-Host "Starting Git history scrub for: $fileList" -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on your repository size..."

# Run git filter-branch to remove the files from all commits
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch $fileList" --prune-empty --tag-name-filter cat -- --all

Write-Host "Git history scrub complete." -ForegroundColor Green
Write-Host "WARNING: Your local Git history has been rewritten." -ForegroundColor Red
Write-Host "If you have already pushed these files to a remote repository (like GitHub), you will need to force push:"
Write-Host "    git push origin --force --all"
Write-Host "    git push origin --force --tags"
Write-Host "`nIMPORTANT: Please remember to rotate your Supabase keys and passwords, as they were previously exposed in git history." -ForegroundColor Red
