import fs from 'fs';
import { google } from 'googleapis';

const credPath = './credentials/google-credentials.json';
const tokenPath = './credentials/google-token.json';
const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive'
];

async function checkAuth() {
  if (!fs.existsSync(credPath)) {
    console.log('Credentials file not found at:', credPath);
    return;
  }

  const rawCreds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const clientConfig = rawCreds.installed || rawCreds.web;

  if (!clientConfig) {
    console.log('Invalid client config format in credentials.json');
    return;
  }

  const { client_secret, client_id, redirect_uris } = clientConfig;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris?.[0] || 'urn:ietf:wg:oauth:2.0:oob'
  );

  if (fs.existsSync(tokenPath)) {
    console.log('Token file exists!');
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oAuth2Client.setCredentials(token);
    
    // Try updating doc directly via API
    try {
      const docs = google.docs({ version: 'v1', auth: oAuth2Client });
      const documentId = '1IHV7i6e9o1rydJ-j0viZFxu4AWj5SvKNHL9QjusIjDw';
      
      console.log('Attempting to insert "i love food" via Google Docs API...');
      const res = await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: 'i love food\n'
              }
            }
          ]
        }
      });
      console.log('API BatchUpdate Success:', res.statusText);
      console.log(`Document URL: https://docs.google.com/document/d/${documentId}/edit`);
    } catch (err) {
      console.error('API Update Error:', err.message);
    }
  } else {
    console.log('No token file found.');
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
    console.log('Auth URL generated:\n' + authUrl);
  }
}

checkAuth();
