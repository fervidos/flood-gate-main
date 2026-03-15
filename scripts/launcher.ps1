Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Set working directory to project root (parent of scripts folder)
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Hide PowerShell console
Add-Type -Name Window -Namespace Console -MemberDefinition '
[DllImport("Kernel32.dll")]
public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
'
[Console.Window]::ShowWindow([Console.Window]::GetConsoleWindow(), 0) | Out-Null

# Form
$form = New-Object System.Windows.Forms.Form
$form.Text = "FloodGate Control"
$form.ClientSize = New-Object System.Drawing.Size(380, 280)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 17, 23)

# Title
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "FloodGate"
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(0, 204, 255)
$lblTitle.AutoSize = $true
$lblTitle.Location = New-Object System.Drawing.Point(110, 20)
$form.Controls.Add($lblTitle)

# Status
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "OFFLINE"
$lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(255, 82, 82)
$lblStatus.AutoSize = $false
$lblStatus.TextAlign = "MiddleCenter"
$lblStatus.Size = New-Object System.Drawing.Size(380, 30)
$lblStatus.Location = New-Object System.Drawing.Point(0, 95)
$form.Controls.Add($lblStatus)

# Start Button
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "START"
$btnStart.Size = New-Object System.Drawing.Size(170, 50)
$btnStart.Location = New-Object System.Drawing.Point(25, 145)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(0, 102, 255)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = "Flat"
$btnStart.FlatAppearance.BorderSize = 0
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnStart.Cursor = [System.Windows.Forms.Cursors]::Hand

# Stop Button
$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "STOP"
$btnStop.Size = New-Object System.Drawing.Size(170, 50)
$btnStop.Location = New-Object System.Drawing.Point(205, 145)
$btnStop.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 60)
$btnStop.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 130)
$btnStop.FlatStyle = "Flat"
$btnStop.FlatAppearance.BorderSize = 0
$btnStop.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnStop.Enabled = $false

# Open Dashboard Button
$btnDashboard = New-Object System.Windows.Forms.Button
$btnDashboard.Text = "OPEN DASHBOARD"
$btnDashboard.Size = New-Object System.Drawing.Size(350, 45)
$btnDashboard.Location = New-Object System.Drawing.Point(15, 215)
$btnDashboard.BackColor = [System.Drawing.Color]::FromArgb(40, 40, 50)
$btnDashboard.ForeColor = [System.Drawing.Color]::FromArgb(0, 204, 255)
$btnDashboard.FlatStyle = "Flat"
$btnDashboard.FlatAppearance.BorderSize = 1
$btnDashboard.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(0, 204, 255)
$btnDashboard.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnDashboard.Cursor = [System.Windows.Forms.Cursors]::Hand

$form.Controls.Add($btnStart)
$form.Controls.Add($btnStop)
$form.Controls.Add($btnDashboard)

$global:nodeProcess = $null

# Function to check if app is already running
function Test-AppRunning {
    try {
        $proc = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' and CommandLine LIKE '%src%index.js%'" -ErrorAction SilentlyContinue
        return $proc -ne $null
    } catch {
        # Fallback for older PowerShell versions or restricted permissions
        $proc = Get-WmiObject Win32_Process -Filter "Name = 'node.exe' and CommandLine LIKE '%src%index.js%'" -ErrorAction SilentlyContinue
        return $proc -ne $null
    }
}

# Function to update UI state
function Update-UIState {
    param([bool]$isRunning)
    
    if ($isRunning) {
        $lblStatus.Text = "RUNNING"
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(0, 230, 118)
        
        $btnStart.Enabled = $false
        $btnStart.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 60)
        $btnStart.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 130)
        
        $btnStop.Enabled = $true
        $btnStop.BackColor = [System.Drawing.Color]::FromArgb(255, 82, 82)
        $btnStop.ForeColor = [System.Drawing.Color]::White
    } else {
        $lblStatus.Text = "OFFLINE"
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(255, 82, 82)
        
        $btnStart.Enabled = $true
        $btnStart.BackColor = [System.Drawing.Color]::FromArgb(0, 102, 255)
        $btnStart.ForeColor = [System.Drawing.Color]::White
        
        $btnStop.Enabled = $false
        $btnStop.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 60)
        $btnStop.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 130)
    }
}

# Check initial status
if (Test-AppRunning) {
    Update-UIState -isRunning $true
}

# Start
$btnStart.Add_Click({
    if (Test-AppRunning) {
        [System.Windows.Forms.MessageBox]::Show("FloodGate is already running.", "Info", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
        return
    }

    try {
        $nodeExe = (Get-Command node -ErrorAction Stop).Source
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Node.js is not installed or not available in PATH. Please install Node.js (>= 18) and try again.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
        return
    }

    Update-UIState -isRunning $true
    
    try {
        $global:nodeProcess = Start-Process -FilePath $nodeExe -ArgumentList "src\index.js" -WorkingDirectory $projectRoot -NoNewWindow -PassThru -WindowStyle Hidden
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Failed to start FloodGate. Check that your dependencies are installed (run `npm install`).", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
        Update-UIState -isRunning $false
    }
})

# Stop
$btnStop.Add_Click({
    # Prefer stopping the process we started, if available
    if ($global:nodeProcess -and -not $global:nodeProcess.HasExited) {
        try {
            $global:nodeProcess | Stop-Process -Force -ErrorAction SilentlyContinue
        } catch {
            # ignore
        }
    }

    try {
        # If we didn't start it, or if it was started elsewhere, try to find it
        $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' and CommandLine LIKE '%src%index.js%'" -ErrorAction SilentlyContinue
        if ($null -eq $procs) {
            $procs = Get-WmiObject Win32_Process -Filter "Name = 'node.exe' and CommandLine LIKE '%src%index.js%'" -ErrorAction SilentlyContinue
        }

        if ($procs) {
            $procs | ForEach-Object { 
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue 
            }
        }
    } catch {
        # Last resort fallback if WMI fails
        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    }
    
    $global:nodeProcess = $null
    Update-UIState -isRunning $false
})

# Open Dashboard
$btnDashboard.Add_Click({
    Start-Process "http://localhost:3000"
})

# Cleanup
$form.Add_FormClosing({
    try {
        $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' and CommandLine LIKE '%src%index.js%'" -ErrorAction SilentlyContinue
        if ($null -eq $procs) {
            $procs = Get-WmiObject Win32_Process -Filter "Name = 'node.exe' and CommandLine LIKE '%src%index.js%'" -ErrorAction SilentlyContinue
        }

        if ($procs) {
            $procs | ForEach-Object { 
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue 
            }
        }
    } catch {
        # Do nothing on close if we can't identify cleanly
    }
})

[void]$form.ShowDialog()

