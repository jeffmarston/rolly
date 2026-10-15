import { createApp } from 'vue'
import '@xterm/xterm/css/xterm.css'
import App from './App.vue'
import DiffApp from './DiffApp.vue'
import './styles/main.scss'

// The diff window is the same bundle under a hash, so there is no second entry to build.
createApp(location.hash.startsWith('#diff:') ? DiffApp : App).mount('#app')
