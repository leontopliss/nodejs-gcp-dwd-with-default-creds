# Domain Wide Delegation using NodeJS and GCP Default Credentials

Domain Wide Delegation using NodeJS and GCP default credentials. Leon Topliss (2020)

## Introduction

GCP compute services such as App Engine, Cloud Functions, Compute have an inbuilt default service account.

This built in default service account can be permitted access to other GCP services negating the need to manage private keys (and/or) secrets to access GCP services.

However to access G-Suite services such as Directory, Gmail and Drive domain-wide delegation of authority is required. This is where the service account can impersonate other G Suite users, and gain access to Google Admin SDK API

All domain wide delegation examples show the use of a private key and using that private key to sign a JWT with the subject set to the user. The challenge with this approach is a private key needs to be maintained with the code.

Rather than distribute a private key it's possible to use the [signBlob](https://cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/signBlob) service giving default credentials access to this service.

The GCP Python auth library includes this functionality and use of this has been documented [here](https://github.com/GoogleCloudPlatform/professional-services/tree/master/examples/gce-to-adminsdk)

This repository implements equivalent functionality for NodeJS

## Prerequisites

* The service account requires the role: roles/iam.serviceAccountTokenCreator
* Enable domain wide delegation on the service account
* A user is required in G-Suite to impersonate. If this is an Admin the account should only have the minimum permissions required.
* In the G-Suite admin console allow access to the Scopes (Security -> Advanced Settings -> Manage API client access). You will need to specify the client ID and a comma separated list of the scopes required
* Enable any API's required in your GCP project (for example Drive, AdminSDK etc..)
* If a using Compute Engine you will need to enable 'Allow full access to all Cloud APIs'. However you may also want to change the default service account the VM runs under giving unnessisary permissions to other VM's with full access set

## Using the examples

defaultcreddelegation.js contains the code for retrieving an access token, or authenticated GCP client

Use of this is demonstrated with two examples

### Send a email using Node Mailer, Gmail API's using OAuth and GCP Default Credentials

This example will send a basic email from a sender in your G-Suite domain to a recipient

``` 
# The sender must be in your G-Suite domain
node sendmail.js <sender> <recipient>
```

### Upload a file to Drive and GCP Default Credentials

This example will upload a basic file to Google Drive

``` 
# The owner
node driveupload.js <owner> 
```
