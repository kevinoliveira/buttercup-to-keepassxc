# buttercup-to-keepassxc
Export passwords, notes and TOTPs from Buttercup to Keepassxc

## Instructions
1. Unlock your buttercup vault
1. Export your vault to CSV (MENU > Current Vault > Export)
1. Compile the program or download the binary from latest release
    - compile:
        - `npm install -g bun`
        - `bun i`
        - `bun build ./main.ts --compile --outfile bcup2kpass`
    - download: [releases page](https://github.com/kevinoliveira/buttercup-to-keepassxc/releases)
1. Feed the CSV into the program 
    `./bcup2kpass --input BUTTERCUP_CSV --output KEEPASSXC_CSV`
1. Import the output csv into keepass (MENU > Database > Import)
1. Finish the import wizard as you wish

## Notes
1. This scritpt works as of September 2024, might not work in the future, use at your own risk
1. Nested groups will be flatten
1. Groups with the same name will be merged
1. Groups from Buttercup's trash will be ignored  
1. Any custom fields that begins with `otpauth://` will be exported as TOTP
1. Any other fields that does not qualify as TOTP will be exported as notes using the following pattern
    ```
        FIELD_1_NAME: FIELD_1_CONTENT
        FIELD_2_NAME: FIELD_2_CONTENT
    ```
1. CSV fields are proprely escaped and passwords with commas and double quotes will be properly exported
1. Buttercup does not export dates, therefore 'Created' and 'Last Modified' will be registed as the moment of export
1. Test/Example files are avaliable on ./examples, the password for both buttercup and keepassxc vauts is `banana` 
