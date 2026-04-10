import React from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css'
import './assets/styles/index.css'
import App from './App'

// Safety filter to remove any jsx props
const originalCreateElement = React.createElement;
React.createElement = function (type, props, ...children) {
  if (props && props.jsx !== undefined) {
    const { jsx, ...cleanProps } = props;
    return originalCreateElement(type, cleanProps, ...children);
  }
  return originalCreateElement(type, props, ...children);
};

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)