#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
npx hardhat run $SCRIPT_DIR/xdai-deployer.ts --network dai