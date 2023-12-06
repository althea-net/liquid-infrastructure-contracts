# Althea Contracts

This folder is the home of miscellaneous Solidity contracts deployed by Althea on various chains.

The contract source files live in `contracts/`. The tests live in `test/` and may use `test-utils/` for reusable testing components.
Testing relies on the use of [HardHat](https://hardhat.org/) and `contract-deployer.ts`, which is called via `scripts/contract-deployer.sh`.

## Compiling the contracts

1. Run `npm install`
1. Run `npm run compile`
1. The compiled files are all placed in artifacts/contracts/\<Contract Name\>.sol/\<Contract Name\>.json, these are directly usable with libraries like ethers.js.

## Testing the contracts

The tests should use [Chai](https://www.chaijs.com/) with the [ethereum-waffle extensions](https://ethereum-waffle.readthedocs.io/en/latest/).

Define tests in the `test/` folder and then run `npm run test` to run them.