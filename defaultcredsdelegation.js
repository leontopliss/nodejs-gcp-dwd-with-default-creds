/* 
 * Copyright 2020 Leon Topliss
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
const {google} = require('googleapis');
const fs = require('fs');

/**
 * Base64 Encode and make URL Safe a string that is passed in
 * We use this to encode parts of the JWT token before sending
 * to be singed
 *  
 *  @param {String|Buffer} data String to convert
 *  @returns {String} base64 URL safe string
 */
function base64UrlSafeEncode(data) {
	return data
	  .toString('base64')
	  .replace(/\+/g, '-')
	  .replace(/\//g, '_')
	  .replace(/=+$/, '')
}

/**
 * Create the header and body of a JWT that we will later sign
 *  
 *  @param {String} sub The subject typically the user we are impersonating
 *  @param {String} service_account The service account we are
 *  running under
 *  @param {Array} scopes A array of scopes we need access too
 *  e.g. ['mail.google.com','https://www.googleapis.com/auth/drive']
 *  @param {String} expiresInMins When the access should expire
 *  @returns {String} A JWT header and body, unsigned at this stage
 */
function createJwt(sub, service_account, scopes, expiresInMins){

	// Its mandatory that the scopes are passed in as an array
	if (!Array.isArray(scopes)) {
    	throw new Error('scopes should be provided as an array');
  	}
	
	const header = {
		"alg":"RS256",
		"typ":"JWT"
	};
  
	const body = {
		"iss": service_account,
		"sub": sub,
		"scope": scopes.join(' '),
		"aud": "https://www.googleapis.com/oauth2/v4/token",
		"exp": Math.floor(Date.now() / 1000) + (expiresInMins * 60),
		"iat": Math.floor(Date.now() / 1000)
	}

	// Base64 encode header and body
	let headerEncoded = base64UrlSafeEncode(Buffer.from(JSON.stringify(header)));
	let bodyEncoded = base64UrlSafeEncode(Buffer.from(JSON.stringify(body)));
	let jwtWithoutSignature = headerEncoded + '.' + bodyEncoded;
	
	return jwtWithoutSignature; 
}

/**
 * Use a signed JWT to get an OAuth access token
 *
 *  @param {String} signedJwt A Google signed JWT
 *  @returns {Object} An object contiaing an access token
 *  and expiry infomation
 */
async function getAccessTokenFromJWT(signedJwt) {

	const googleClient = new google.auth.GoogleAuth();

	const url = `https://www.googleapis.com/oauth2/v4/token`;
	const headers = {
		'Content-Type': 'application/json',
	};
	let data = {
		grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
		assertion: signedJwt,
	};
	const res = await googleClient.request({
		url: url,
		headers: headers,
		data: data,
		method: 'POST'
	});
	
	return res.data;
}

/**
 * Get a JWT that is signed by Google
 *  
 *  @param {String} sub The subject typically the user we are impersonating
 *  @param {Array} scopes A array of scopes we need access too
 *  e.g. ['mail.google.com','https://www.googleapis.com/auth/drive']
 *  @param {String} expiresInMins When the access should expire
 *  @returns {String} A complete JWT signed by Google
 */
async function getSignedJwt(sub, scopes, expiresInMins) {

	// Initial auth client. It only needs IAM scopes as
	// as we use this to contact IAM signBlob to get
	// a token with the scopes we require
	const authClient = new google.auth.GoogleAuth({
		scopes: ['https://www.googleapis.com/auth/iam']
	});
	
	// Get the application default service account we are running under
	const creds = await authClient.getCredentials();
	const service_account = creds.client_email;

	// Create a JWT with the required subject and scopes
	const jwt = createJwt(sub, service_account, scopes, expiresInMins);

	// Use the GCP IAM to sign the JWT
	// https://cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/signBlob
	// Using the sign function built into google.auth.GoogleAuth 
	const jwtSignature = await authClient.sign(jwt);
  
	// Add the signature to the token for a complete JWT
	const signedJwt = jwt + "." + base64UrlSafeEncode(jwtSignature);

	return signedJwt;
}

/**
 * Get a OAuth Access token
 * If running in GCP this will attempt to use default credentials
 * For use outside of GCP ensure the environment variable GOOGLE_APPLICATION_CREDENTIALS
 * is set with the location of the private key JSON file
 *  
 *  @param {String} sub The subject typically the user we are impersonating
 *  @param {Array} scopes A array of scopes we need access too
 *  e.g. ['mail.google.com','https://www.googleapis.com/auth/drive']
 *  @returns {Object} An object contiaing an access token
 *  and expiry infomation
 */
async function getAccessToken(sub, scopes) {

	// Determine if we are running in GCP
	const gcpEnviroment = await google.auth.getEnv()

	let token;
	// If we are running in GCP use a default service account
	// If not in GCP the GOOGLE_APPLICATION_CREDENTIALS environment variable 
	// should be set to point the the location of the private key
	if (gcpEnviroment) {
		// Running in GCP

		// Get at a signed JWT
		const signedJwt = await getSignedJwt(sub, scopes, 60);
	
		// Exchange the signed JWT for an access token
		token = await getAccessTokenFromJWT(signedJwt);
	} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		// Running outside GCP with a private key

		// Open the JSON Key
		const credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
		let credentials = JSON.parse(fs.readFileSync(credentialsFile));

		// Use the JSON Key but change the subject
		var authClient = new google.auth.JWT(
			credentials.client_email,
			null,
			credentials.private_key,
			scopes,
			sub
		);

		// Exchange the signed JWT for an access token
		token = await authClient.authorize();
	} else {
		throw('Not running in GCP so unable to use a default service account and unable a keyfile')
	}

	return token;
}

/**
 * Get an authenticated Google Client for use with Google SDK's
 *  
 *  @param {String} sub The subject typically the user we are impersonating
 *  @param {Array} scopes A array of scopes we need access too
 *  e.g. ['mail.google.com','https://www.googleapis.com/auth/drive']
 *  @returns {instance} An authenticated instance of the Google Client
 */
async function getAuthClient(sub, scopes) {
	
	// Get an OAuth2 access token
	token = await getAccessToken(sub, scopes)

	// Use the token to create a google auth client
	const oauth2Client = new google.auth.OAuth2();
	oauth2Client.setCredentials(token);
	
	return oauth2Client;
}

module.exports = {
	getAccessToken: getAccessToken,
	getAuthClient: getAuthClient
}