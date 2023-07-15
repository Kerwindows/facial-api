# Getting Started with Facial App

This project was originally bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

## Upload Images

Images go into the `public > images` folder

## facialRecognitionArray

url is the file path that points to the image file names
e.g.

```
{
    url: process.env.PUBLIC_URL + '/images/jemila.jpg',
    label: 'Jemila Thompson',
    id: '87536357',
  },
```
