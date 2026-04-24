Add-Type -AssemblyName System.Drawing

$width = 1800
$height = 1200
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#2C89AA'))

function New-Brush($hex) { New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function New-Pen($hex, $width = 3) {
  $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $pen
}
function New-RoundedPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x,$y,$d,$d,180,90)
  $path.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $path.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $path.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $path.CloseFigure(); return $path
}
function Draw-RoundedRect($x,$y,$w,$h,$r,$fillHex,$strokeHex,$strokeWidth=3){
  $path = New-RoundedPath $x $y $w $h $r
  $fill = New-Brush $fillHex
  $pen = New-Pen $strokeHex $strokeWidth
  $graphics.FillPath($fill,$path)
  $graphics.DrawPath($pen,$path)
  $fill.Dispose(); $pen.Dispose(); $path.Dispose()
}
function Draw-Card($x,$y,$w,$h,$fillHex,$strokeHex){
  Draw-RoundedRect ($x+6) ($y+10) $w $h 20 '#236E8C' '#236E8C' 1
  Draw-RoundedRect $x $y $w $h 20 $fillHex $strokeHex 3
}
function Draw-Diamond($cx,$cy,$w,$h,$fillHex,$strokeHex){
  $pts=@([System.Drawing.PointF]::new($cx,$cy-$h/2),[System.Drawing.PointF]::new($cx+$w/2,$cy),[System.Drawing.PointF]::new($cx,$cy+$h/2),[System.Drawing.PointF]::new($cx-$w/2,$cy))
  $fill=New-Brush $fillHex; $pen=New-Pen $strokeHex 3
  $graphics.FillPolygon($fill,$pts); $graphics.DrawPolygon($pen,$pts)
  $fill.Dispose(); $pen.Dispose()
}
function Draw-Arrow($x1,$y1,$x2,$y2,$hex,$width=3){
  $pen = New-Pen $hex $width
  $pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(7,9,$true)
  $graphics.DrawLine($pen,$x1,$y1,$x2,$y2)
  $pen.Dispose()
}
function Draw-Text($text,$font,$brush,$x,$y){ $graphics.DrawString($text,$font,$brush,$x,$y) }
function Draw-CenteredText($text,$font,$brush,$rect){
  $fmt=New-Object System.Drawing.StringFormat
  $fmt.Alignment=[System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment=[System.Drawing.StringAlignment]::Center
  $graphics.DrawString($text,$font,$brush,$rect,$fmt)
  $fmt.Dispose()
}
function Draw-Badge($x,$y,$w,$text,$fillHex,$textHex){
  Draw-RoundedRect $x $y $w 30 15 $fillHex $fillHex 1
  $font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
  $brush = New-Brush $textHex
  Draw-CenteredText $text $font $brush ([System.Drawing.RectangleF]::new($x,$y,$w,30))
  $font.Dispose(); $brush.Dispose()
}
function Draw-LabeledCircle($cx,$cy,$fillHex,$text){
  $fill=New-Brush $fillHex; $pen=New-Pen '#16202A' 3; $font=New-Object System.Drawing.Font('Segoe UI',10,[System.Drawing.FontStyle]::Bold); $brush=New-Brush '#FFFFFF'
  $graphics.FillEllipse($fill,$cx-24,$cy-24,48,48); $graphics.DrawEllipse($pen,$cx-24,$cy-24,48,48)
  Draw-CenteredText $text $font $brush ([System.Drawing.RectangleF]::new($cx-24,$cy-26,48,48))
  $fill.Dispose(); $pen.Dispose(); $font.Dispose(); $brush.Dispose()
}

$titleFont = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Regular)
$sectionFont = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$boxTitleFont = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$boxFont = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Regular)
$smallFont = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Regular)
$white = New-Brush '#FFFFFF'; $dark = New-Brush '#132233'; $muted = New-Brush '#345264'

Draw-Text 'HR App User Flow Diagram' $titleFont $white 360 34
Draw-Text 'Reference flow for customer presentation based on current application modules and approval behavior.' $subFont $white 360 90
Draw-Text 'PulsePresen / HR App' $sectionFont $white 1440 36
Draw-Text 'Attendance, Payroll, Profile, Approval, Reporting' $smallFont $white 1440 68

# Start emblem
$ring = New-Pen '#11202D' 5
$graphics.DrawEllipse($ring, 92, 100, 180, 180)
$graphics.DrawEllipse((New-Pen '#9FDBF3' 4), 106, 114, 152, 152)
Draw-RoundedRect 136 145 92 118 18 '#FFFFFF' '#24384A' 3
Draw-RoundedRect 128 176 108 48 15 '#F6C22C' '#1A1A1A' 4
$startFont = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
Draw-CenteredText 'START' $startFont $dark ([System.Drawing.RectangleF]::new(128,178,108,42))
Draw-Text 'Open app' $smallFont $dark 152 268

Draw-Text 'Employee / Manager Flow' $sectionFont $white 100 315
Draw-Text 'Manager also uses employee modules plus approval queue.' $smallFont $white 100 344
Draw-Text 'HR / Admin Flow' $sectionFont $white 1415 315
Draw-Text 'Operations, payroll, reporting, and monitoring.' $smallFont $white 1415 344

# row 1
Draw-Card 90 400 240 108 '#CFEAF6' '#1B1B1B'
Draw-Text 'Enter Login Info' $boxTitleFont $dark 138 435
Draw-Text 'User signs in to access the system.' $smallFont $dark 125 468

Draw-Diamond 445 454 190 118 '#FFFFFF' '#1B1B1B'
Draw-CenteredText 'Role' $boxTitleFont $dark ([System.Drawing.RectangleF]::new(398,422,94,34))
Draw-CenteredText 'recognized?' $boxTitleFont $dark ([System.Drawing.RectangleF]::new(360,452,170,34))
Draw-LabeledCircle 445 372 '#5DBB63' 'Yes'
Draw-LabeledCircle 445 574 '#EB695B' 'No'

Draw-Card 565 400 270 108 '#CFEAF6' '#1B1B1B'
Draw-Text 'Employee Dashboard' $boxTitleFont $dark 625 435
Draw-Text 'Personal attendance graph, check-in, live summary.' $smallFont $dark 592 468

Draw-Card 920 400 300 108 '#F5E389' '#1B1B1B'
Draw-Text 'Employee Attendance Hub' $boxTitleFont $dark 972 435
Draw-Text 'On Duty, Sick, Leave, Half Day, Submit Overtime.' $smallFont $dark 948 468
Draw-Badge 1112 416 80 'REQUEST' '#E6F8F5' '#0F9F8F'

Draw-Card 1245 400 220 108 '#CFEAF6' '#1B1B1B'
Draw-Text 'Payroll + Profile' $boxTitleFont $dark 1364 435
Draw-Text 'Generate payslip, history slip gaji, employee data.' $smallFont $dark 1314 468
Draw-Badge 1378 416 68 'VIEW' '#FFF4DF' '#B7791F'

# row 2 center decision
Draw-Diamond 1070 640 220 130 '#FFFFFF' '#1B1B1B'
Draw-CenteredText 'Need leader' $boxTitleFont $dark ([System.Drawing.RectangleF]::new(995,604,150,32))
Draw-CenteredText 'approval?' $boxTitleFont $dark ([System.Drawing.RectangleF]::new(1005,640,130,32))
Draw-LabeledCircle 1070 552 '#5DBB63' 'Yes'
Draw-LabeledCircle 1202 640 '#5DBB63' 'View'
Draw-LabeledCircle 1070 760 '#EB695B' 'Revise'

Draw-Card 90 620 240 100 '#CFEAF6' '#1B1B1B'
Draw-Text 'Retry Login' $boxTitleFont $dark 155 654
Draw-Text 'If role/login is invalid, user retries sign-in.' $smallFont $dark 111 686

Draw-Card 885 790 320 104 '#CFEAF6' '#1B1B1B'
Draw-Text 'Revise / Resubmit Request' $boxTitleFont $dark 940 824
Draw-Text 'Employee edits request and submits again.' $smallFont $dark 940 856

# row 3 approval and updates
Draw-Card 525 900 320 112 '#BFEBDD' '#1B1B1B'
Draw-Text 'Manager Approval Queue' $boxTitleFont $dark 594 936
Draw-Text 'Manager opens same attendance pages with approval area.' $smallFont $dark 551 969

Draw-Diamond 960 956 205 124 '#FFFFFF' '#1B1B1B'
Draw-CenteredText 'Approve' $boxTitleFont $dark ([System.Drawing.RectangleF]::new(905,924,110,32))
Draw-CenteredText 'request?' $boxTitleFont $dark ([System.Drawing.RectangleF]::new(905,960,110,32))
Draw-LabeledCircle 960 868 '#5DBB63' 'Yes'
Draw-LabeledCircle 960 1068 '#EB695B' 'No'

Draw-Card 1080 884 310 112 '#F5E389' '#1B1B1B'
Draw-Text 'System Updates Records' $boxTitleFont $dark 1140 920
Draw-Text 'Attendance, leave history, overtime status,' $smallFont $dark 1115 953
Draw-Text 'dashboard summary, and records per menu.' $smallFont $dark 1110 975

Draw-Card 1080 1030 310 112 '#F9D2CF' '#1B1B1B'
Draw-Text 'Rejected Back to Employee' $boxTitleFont $dark 1142 1066
Draw-Text 'Request remains pending revision / resubmission.' $smallFont $dark 1120 1098

# HR right column
Draw-Card 1510 400 230 100 '#F5E389' '#1B1B1B'
Draw-Text 'HR / Admin Dashboard' $boxTitleFont $dark 1508 435
Draw-Text 'Company-wide dashboard and controls.' $smallFont $dark 1494 468

Draw-Card 1510 550 230 100 '#CFEAF6' '#1B1B1B'
Draw-Text 'Employee List' $boxTitleFont $dark 1532 585
Draw-Text 'Master data, salary, allowance, deduction.' $smallFont $dark 1490 618

Draw-Card 1510 700 230 100 '#CFEAF6' '#1B1B1B'
Draw-Text 'Attendance Monitoring' $boxTitleFont $dark 1498 735
Draw-Text 'Report attendance, requests, and overtime.' $smallFont $dark 1490 768

Draw-Card 1510 850 230 100 '#CFEAF6' '#1B1B1B'
Draw-Text 'Payroll + Reports' $boxTitleFont $dark 1526 885
Draw-Text 'Payroll process, payslip, employee and attendance reports.' $smallFont $dark 1478 918

# arrows
Draw-Arrow 182 280 182 400 '#111111' 3
Draw-Arrow 330 454 350 454 '#111111' 3
Draw-Arrow 445 396 445 400 '#111111' 3
Draw-Arrow 445 512 445 550 '#111111' 3
Draw-Arrow 445 598 445 620 '#111111' 3
Draw-Arrow 330 670 182 670 '#111111' 3
Draw-Arrow 182 670 182 508 '#111111' 3
Draw-Arrow 469 372 565 372 '#111111' 3
Draw-Arrow 835 454 920 454 '#111111' 3
Draw-Arrow 1220 454 1245 454 '#111111' 3
Draw-Arrow 1070 552 1070 575 '#111111' 3
Draw-Arrow 1206 640 1245 640 '#111111' 3
Draw-Arrow 1070 705 1070 760 '#111111' 3
Draw-Arrow 1070 760 1070 790 '#111111' 3
Draw-Arrow 885 842 700 842 '#111111' 3
Draw-Arrow 700 842 700 508 '#111111' 3
Draw-Arrow 700 508 920 508 '#111111' 3

Draw-Arrow 970 640 700 900 '#0F4C41' 4
Draw-Arrow 845 956 858 956 '#111111' 3
Draw-Arrow 960 892 1080 892 '#111111' 3
Draw-Arrow 960 1018 960 1044 '#111111' 3
Draw-Arrow 984 1068 1080 1068 '#111111' 3

Draw-Arrow 1625 500 1625 550 '#111111' 3
Draw-Arrow 1625 650 1625 700 '#111111' 3
Draw-Arrow 1625 800 1625 850 '#111111' 3
Draw-Arrow 1390 940 1510 940 '#B7791F' 4
Draw-Arrow 1510 940 1510 750 '#B7791F' 4

Draw-Text 'employee route' $smallFont $white 780 430
Draw-Text 'request submission' $smallFont $white 1016 380
Draw-Text 'approval route' $smallFont $white 740 840
Draw-Text 'approved data becomes HR input' $smallFont $white 1310 920

Draw-RoundedRect 60 1122 1680 42 18 '#1E6E8D' '#1E6E8D' 1
Draw-Text 'Summary: Employee or manager logs in -> submits attendance request -> manager approves/rejects -> system updates records -> HR/Admin uses the output for payroll and reporting.' $boxFont $white 95 1134

$outPath = 'docs\\hr-app-user-flow-diagram.png'
$bitmap.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose(); $titleFont.Dispose(); $subFont.Dispose(); $sectionFont.Dispose(); $boxTitleFont.Dispose(); $boxFont.Dispose(); $smallFont.Dispose(); $white.Dispose(); $dark.Dispose(); $muted.Dispose(); $ring.Dispose(); $startFont.Dispose()
Write-Output $outPath

