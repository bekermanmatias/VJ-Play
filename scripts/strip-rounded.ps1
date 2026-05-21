# Elimina clases Tailwind 'rounded(-*)' SOLO dentro de strings de class/className.
# No toca espacios fuera de los atributos, así el formato del código queda intacto.
$root = "C:\Users\beker\OneDrive\Escritorio\Repositorios\VJ Play\frontend\src"
$files = Get-ChildItem -Path $root -Recurse -Include *.astro,*.tsx -File

$classPattern = '(?:[a-z]+:)*rounded(?:-[a-zA-Z0-9]+)*'

function Clean-Classes($str) {
    $r = [regex]::Replace($str, $classPattern, '')
    # Colapsar espacios en blanco dentro de la string de clases.
    $r = $r -replace '\s+', ' '
    return $r.Trim()
}

$totalChanged = 0
foreach ($f in $files) {
    $original = [System.IO.File]::ReadAllText($f.FullName)
    $content = $original

    # 1) Atributos: class="..." o className="..."
    $content = [regex]::Replace($content, '(\bclass(?:Name)?\s*=\s*)"([^"]*)"', {
        param($m)
        $cleaned = Clean-Classes $m.Groups[2].Value
        return "$($m.Groups[1].Value)`"$cleaned`""
    })

    # 2) Strings literales con dobles comillas que parecen ser strings de clases (sin chars raros)
    $content = [regex]::Replace($content, '"([^"\n]*\brounded[a-zA-Z0-9-]*[^"\n]*)"', {
        param($m)
        $body = $m.Groups[1].Value
        if ($body -match '^[\sa-zA-Z0-9:_/\[\]\(\)\.\-\,#%+]+$') {
            $cleaned = Clean-Classes $body
            return "`"$cleaned`""
        }
        return $m.Value
    })

    # 3) Cualquier secuencia tipo `... rounded ...` (template literals JSX): solo eliminar la clase rounded en sí,
    #    sin tocar el resto del template (porque puede contener ${...} expresiones).
    $content = [regex]::Replace($content, '\s' + $classPattern + '\b', '')
    $content = [regex]::Replace($content, '\b' + $classPattern + '\s', ' ')
    $content = [regex]::Replace($content, '\b' + $classPattern + '\b', '')

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $content)
        $totalChanged++
        Write-Host "Updated: $($f.FullName.Substring($root.Length + 1))"
    }
}

Write-Host "`nTotal updated: $totalChanged"
