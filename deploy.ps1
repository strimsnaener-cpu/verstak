# Выкладка «Утильки» на GitHub Pages (бесплатно).
# Один раз перед этим: gh auth login --web
# Запуск: powershell -ExecutionPolicy Bypass -File deploy.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$repo = "utilka"

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Сначала войди в GitHub: gh auth login --web" -ForegroundColor Yellow; exit 1 }
$user = gh api user --jq .login

git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Обновление сайта" | Out-Null }

gh repo view "$user/$repo" *> $null
if ($LASTEXITCODE -ne 0) {
  gh repo create $repo --public --source . --remote origin --push --description "Утилька — бесплатные онлайн-инструменты"
  gh api -X POST "repos/$user/$repo/pages" -f "source[branch]=main" -f "source[path]=/" | Out-Null
} else {
  if (-not ((git remote) -contains "origin")) { git remote add origin "https://github.com/$user/$repo.git" }
  git push -u origin main
}
Write-Host ""
Write-Host "Готово! Сайт будет доступен через 1-2 минуты:" -ForegroundColor Green
Write-Host "https://$user.github.io/$repo/" -ForegroundColor Cyan
