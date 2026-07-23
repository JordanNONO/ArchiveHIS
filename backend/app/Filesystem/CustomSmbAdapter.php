<?php

namespace App\Filesystem;

use Icewind\SMB\ServerFactory;
use Illuminate\Filesystem\FilesystemAdapter;
use League\Flysystem\Adapter\AbstractAdapter;
use League\Flysystem\Config;
use League\Flysystem\Filesystem;

class CustomSmbAdapter extends AbstractAdapter
{
    protected $smb;

    public function __construct($config)
    {
        $factory = new ServerFactory();
        $server = $factory->createServer($config['host'],[ $config['username'], $config['password']]);
        $share = $server->getShare($config['share']);
        $this->smb = $share;
    }

    public function write($path, $contents, Config $config)
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $contents);
        rewind($stream);

        $result = $this->smb->put($path, $stream);
        fclose($stream);

        return $result;
    }

    // Implement other methods like writeStream, read, delete, etc.
}
