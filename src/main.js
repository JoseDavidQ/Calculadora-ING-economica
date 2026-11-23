import './style.css';
import { createApp } from './app.js';
import simple from './tabs/simple.js';
import compuesto from './tabs/compuesto.js';
import tasas from './tabs/tasas.js';
import anualidades from './tabs/anualidades.js';
import amortizacion from './tabs/amortizacion.js';

createApp([simple, compuesto, tasas, anualidades, amortizacion]);
