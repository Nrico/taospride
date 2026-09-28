<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this helper from the command line.\n");
    exit(1);
}

function read_hidden(string $prompt): string
{
    fwrite(STDERR, $prompt);

    $canHide = DIRECTORY_SEPARATOR !== '\\' && trim((string) shell_exec('command -v stty')) !== '';
    if ($canHide) shell_exec('stty -echo');

    try {
        $value = fgets(STDIN);
    } finally {
        if ($canHide) shell_exec('stty echo');
        fwrite(STDERR, PHP_EOL);
    }

    return rtrim((string) $value, "\r\n");
}

$password = read_hidden('New admin password: ');
$confirm  = read_hidden('Confirm admin password: ');

if ($password !== $confirm) {
    fwrite(STDERR, "Passwords do not match.\n");
    exit(1);
}

if (strlen($password) < 16) {
    fwrite(STDERR, "Use at least 16 characters.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
if ($hash === false) {
    fwrite(STDERR, "Unable to generate a password hash.\n");
    exit(1);
}

fwrite(STDOUT, $hash . PHP_EOL);
