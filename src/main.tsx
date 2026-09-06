import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter'
// A fonte de ícones é declarada no index.css a partir do subset em src/assets —
// o CSS do pacote traz a variável completa de 3,8 MB. Ver scripts/subset-icons.mjs.
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
