/* 
    An example showing how to upload a file to drive using:
    - GCP Default Credentials
    - And Delegated Credentials
    
    Your GCP Default Account must have access to the 
    'Service Account Token Creator' role for this to work
*/

'use strict';
const {google} = require('googleapis');
const auth = require('./defaultcredsdelegation.js');

async function main() {

        // In this example the primary email of the user comes from a CLI arg
        // An example file will be uploaded to this user
        // i.e. node driveupload.js email@domain.com
        if ( typeof process.argv[2] == 'undefined') {
                console.log(`Usage: node ${process.argv[1]} <primary email of user>`)
                process.exit(1);
        } 

        // The subject is the user we want to impersonate
        const subject = process.argv[2];
        
        // The scopes are what we want access too
        // These need to be allowed in the G-Suite security settings
        // and API's enabled in the GCP project
        const scopes = ['https://www.googleapis.com/auth/drive'];
        
        // Now we have a standard Google authenticated client
        const authClient = await auth.getAuthClient(subject, scopes);

        // Using the Google Drive SDK
        const drive = google.drive({
                version: 'v3',
                auth: authClient
        });

        const res = await drive.files.create({
                requestBody: {
                        name: 'Test',
                        mimeType: 'text/plain'
                },
                media: {
                        mimeType: 'text/plain',
                        body: 'File uploaded using default credentials and delegation :-)'
                }
        });

        if (res.status == 200) {
                console.log(`Sucessfully uploaded a file the Drive of ${subject}`);
        }
}

main().catch(console.error);