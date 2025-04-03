# pb-sync (Pocketbase Sync)
A command line tool to sync data between two Pocketbase instances.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Using stdin Input](#using-stdin-input)
  - [Using Environment Variables](#using-environment-variables)

## Features
- Downloads a backup from the source Pocketbase instance
- Uploads the backup to the target Pocketbase instance 
- Progress bar showing download status
- Support for environment variables or manual credential entry
- Error handling and cleanup of temporary files

## Installation
1. Clone this repository
2. Run `npm install` to install dependencies
3. Create a `.env` file (optional) with your credentials

## Usage

> [!CAUTION]
> All data inside target instance will be lost and replaced with the data from source instace

> [!IMPORTANT]  
> You need superuser account for both source and target instances.

### Using stdin Input
- Run `npm run start` to start using the tool
- Input the credentials as prompted and wait for the tool to download, upload and restore the data.

### Using Environment Variables
Create a `.env` file with the following variables:
```txt
SOURCE_URL=
SOURCE_EMAIL=
SOURCE_PASSWORD=

TARGET_URL=
TARGET_EMAIL=
TARGET_PASSWORD=
```

then run the tool using `npm run start` and wait for the tool to download, upload and restore the data.