/* 
 *    An example showing send an email:
 *    - Using Nodemailer with the Gmail API
 *    - GCP Default Credentials
 *    - And Delegated Credentials
 *    
 *    Your GCP Default Account must have access to the 
 *    'Service Account Token Creator' role for this to work
 */
'use strict';
const nodemailer = require('nodemailer');
const auth = require('./defaultcredsdelegation.js');

// GMail Relay config
const mailHost = 'smtp.gmail.com';
const mailPort = 587;

async function sendEmail(accessToken, mailFrom, mailTo) {

    let transporter = nodemailer.createTransport({
        host: mailHost,
        port: mailPort,
        secure: false, // true for 465, false for other ports
        requireTLS: true,
        /* 
         *    Using the Nodemailer OAuth2 authentication https://nodemailer.com/smtp/oauth2/
         *    The service account requires access to the scope 
         *    https://mail.google.com/ (set in the G-Suite console) and the Gmail API enabling in the GCP Project.
         *    Username and Password isn't an option as it required 'less secure apps' to be activated
         */
        auth: {
            type: "OAuth2",
            user: mailFrom,
            accessToken: accessToken
        }
    });

    transporter.sendMail({
        from: mailFrom,
        to: mailTo,
        subject: 'Test Message using OAuth2 and Application Default Credentitals',
        text: 'A mail sent using OAuth2 authentication and the build in GCP service account with the subject changed',
        auth: {
                user: mailFrom
        }
    });

}

async function main() {

    // In this example the primary email of the sending user 
    // and the recipient are passed in as CLI args
    // The sender must be in your domain
    // i.e. node sendmail.js sender@domain.com recipient@domain.com
    if ( typeof process.argv[2] == 'undefined' || typeof process.argv[3] == 'undefined') {
        console.log(`Usage: node ${process.argv[1]}  <sender email address> <recipient email address>`)
        process.exit(1);
    }   

    // Sender and recipient come from CLI in this example
    const mailFrom = process.argv[2];
    const mailTo = process.argv[3];
    
    // The subject for the access token will need to be the same as the user
    // we want to send the email from
    const subject = mailFrom;

    // The scope we need to send email from the Gmail API
    const scopes = ['https://mail.google.com'];

    // Get a delegated access token
    const token = await auth.getAccessToken(subject, scopes);
    const accessToken = token.access_token;
    
    // Use the access token to send an email via nodemailer
    sendEmail(accessToken, mailFrom, mailTo);
}

main().catch(console.error);