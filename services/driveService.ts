
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGapi = async () => {
  if (!window.gapi) return;
  await new Promise<void>((resolve) => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      });
      gapiInited = true;
      resolve();
    });
  });
};

export const initGis = (clientId: string) => {
  if (!window.google || !clientId) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '', // Defined at request time
  });
  gisInited = true;
};

export const requestAccessToken = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject("Token client not initialized. Check Client ID.");
    
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve(resp.access_token);
    };
    
    // Prompt the user to select an account even if they are already logged in
    tokenClient.requestAccessToken({ prompt: 'select_account consent' });
  });
};

// Helper to create a folder
export const createDriveFolder = async (folderName: string, accessToken: string): Promise<string> => {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  const data = await response.json();
  return data.id;
};

// Helper to upload a base64 image
export const uploadFileToDrive = async (
  base64Data: string, 
  fileName: string, 
  folderId: string, 
  accessToken: string
): Promise<void> => {
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  // Extract base64 data (remove prefix if present)
  const data = base64Data.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

  const metadata = {
    name: fileName,
    mimeType: 'image/png',
    parents: [folderId]
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/png\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    data +
    close_delim;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'multipart/related; boundary="' + boundary + '"',
    },
    body: multipartRequestBody,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
};
