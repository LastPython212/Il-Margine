import './globals.css';
export const metadata={title:'Il Margine — Notizie dal mondo del libro',description:'Aggregatore di notizie sull’editoria e il mercato librario'};
export default function RootLayout({children}){
  return(<html lang="it"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lora:ital,wght@0,500;0,600;1,400&display=swap" rel="stylesheet"/>
  </head><body>{children}</body></html>);
}
