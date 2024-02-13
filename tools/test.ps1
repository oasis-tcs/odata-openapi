$processTimer = [System.Diagnostics.Stopwatch]::StartNew()

Get-ChildItem "./tests" -Filter *.xml |
Foreach-Object {
  $basename = $_.BaseName # FullName
  Write-Output $basename
  node ./transform.js -dp tests/$basename.xml -t tests/$basename.openapi3.json
  node ./transform.js -dp -o 2.0 tests/$basename.xml -t tests/$basename.swagger.json
}

$processTimer.Stop()
Write-Output " "
Write-Output  ("{0} seconds" -f $processTimer.Elapsed.TotalSeconds)
