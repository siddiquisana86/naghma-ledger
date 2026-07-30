// Fill these in during setup (see SETUP.md). Values here are safe to be
// public in a client-side app: the OAuth Client ID and restricted API key
// are meant to be visible in browser code; real access control lives in
// the Google Sheet's own sharing permissions, not in these values.
export const CONFIG = {
  SPREADSHEET_ID: '1ePRzKmFXtbAbkvlpxV3FoOGo3T6nHLmv3j1caCvQYc0',
  API_KEY: 'AIzaSyCmMO19z60bh2chO2NjjTQUTf-pnEQ6Gx0',
  CLIENT_ID: '520606929626-ccg7bq6deqtct1f93cdiup0jnpo53fct.apps.googleusercontent.com',

  // When true, the app renders from js/mockData.js instead of calling the
  // real Sheets API, so the UI can be reviewed without any credentials.
  USE_MOCK_DATA: false,
};
