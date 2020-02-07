@echo off 
setlocal
set here=%~dp0


@rem  This script uses the Apache Xalan 2.7.2 XSLT processor
@rem  For a description of Xalan command-line parameters see http://xalan.apache.org/xalan-j/commandline.html
@rem
@rem  Prerequisites
@rem  - Java SE is installed and in the PATH - download from http://www.oracle.com/technetwork/java/javase/downloads/index.html 
@rem  - git is installed and in the PATH - download from https://git-for-windows.github.io/
@rem    Xalan is installed and CLASSPATH contains xalan.jar and serializer.jar - download from http://xalan.apache.org/xalan-j/downloads.html
set CLASSPATH=%here%xalan/xalan.jar;%here%xalan/serializer.jar
@rem  - YAJL's json_reformat from https://github.com/lloyd/yajl has been compiled and is in the PATH
@rem  - Node.js is installed - download from https://nodejs.org/
@rem  - ajv-cli is installed - npm install -g ajv-cli
@rem  - https://github.com/OAI/OpenAPI-Specification is cloned next to this project
set SCHEMA_THREE=%here..\..\OpenAPI-Specification\schemas\v3.0\schema.json

if exist "%1" (
  if /I [%2]==[V2] (
    call :process %1 http localhost /service-root V2
  ) else (
    call :process %1 http localhost /service-root V4
  )
) else (
  echo Usage: transform source [V2]
  echo.
  echo   source       Specifies the file to be transformed.
  echo   V2           Indicates that source is OData V2 or OData V3

)

endlocal
exit /b


:process
  echo %~n1
  
  if [%5]==[V2] (
    java.exe org.apache.xalan.xslt.Process -L -XSL %here%V2-to-V4-CSDL.xsl -IN %1 -OUT %~dpn1.V4.xml
    set VERSION=2.0
    set INPUT=%~dpn1.V4.xml
  ) else if [%5]==[V3] (
    java.exe org.apache.xalan.xslt.Process -L -XSL %here%V2-to-V4-CSDL.xsl -IN %1 -OUT %~dpn1.V4.xml
    set VERSION=3.0
    set INPUT=%~dpn1.V4.xml
  ) else (
    set VERSION=4.0
    set INPUT=%1
  )

  java.exe org.apache.xalan.xslt.Process -L -XSL %here%V4-CSDL-to-OpenAPI.xsl -PARAM scheme %2 -PARAM host %3 -PARAM basePath %4 -PARAM odata-version %VERSION% -PARAM diagram YES -PARAM references "%6" -PARAM openapi-root "https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/" -PARAM openapi-version 3.0.0 -IN %INPUT% -OUT %~dpn1.tmp3.json

  json_reformat.exe < %~dpn1.tmp3.json > %~dpn1.openapi3.json
  if not errorlevel 1 (
    del %~dpn1.tmp3.json
    if [%5]==[V2] del %~dpn1.V4.xml
    if [%5]==[V3] del %~dpn1.V4.xml

    pushd .
    %~d1
    cd %~p1
    git.exe --no-pager diff %~n1.openapi3.json 2>nul
    popd

    if exist %SCHEMA_THREE% call ajv validate -s %SCHEMA_THREE% -d %~dpn1.openapi3.json > nul
  )

exit /b