<?php
// Copy this file to config.php and fill in the MySQL database details from
// your host's control panel (e.g. Hostinger hPanel -> Databases -> MySQL
// Databases). config.php is gitignored — it holds real credentials and
// should never be committed.
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');

// Used to sign the "remember me" session cookie. Change this to any long
// random string before you go live (it does not need to be memorized).
define('APP_SECRET', 'change-this-to-a-long-random-string');
