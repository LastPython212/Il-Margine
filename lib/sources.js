export const CATS=['Mercato & Dati','Novità Librarie','Critica & Riviste','Fiere ed Eventi','Editoria Internazionale','Lavoro & Freelance','Politiche & Accessibilità'];
const s=(name,url,cat)=>({name,url,cat,on:true,auto:true,seed:true});
// Fonti tratte da: correttricedibozze.wordpress.com — "Come tenersi aggiornati sul mondo editoriale"
export const SEEDS=[
s('Giornale della Libreria','https://www.giornaledellalibreria.it/','Mercato & Dati'),
s('AIE','https://www.aie.it/','Mercato & Dati'),
s('ADEI','https://www.associazioneadei.it/','Mercato & Dati'),
s('ALI – Librai Italiani','https://libraitaliani.it/','Mercato & Dati'),
s('Primaonline – Editoria','https://www.primaonline.it/media/dati_cifre_editoria/','Mercato & Dati'),
s('Redacta (ACTA)','https://www.actainrete.it/redacta/','Lavoro & Freelance'),
s('Strade – Traduttori','https://www.traduttoristrade.it/','Lavoro & Freelance'),
s('Correttore bozze','https://correttricedibozze.wordpress.com/','Lavoro & Freelance'),
s('Fondazione LIA','https://www.fondazionelia.org/','Politiche & Accessibilità'),
s('Centro per il libro e la lettura','https://centroperillibro.cultura.gov.it/','Politiche & Accessibilità'),
s('Salone del Libro di Torino','https://www.salonelibro.it/','Fiere ed Eventi'),
s('Bologna Children’s Book Fair','https://www.bolognachildrensbookfair.com/','Fiere ed Eventi'),
s('Più libri più liberi','https://plpl.it/','Fiere ed Eventi'),
s('Frankfurter Buchmesse','https://www.buchmesse.de/en','Fiere ed Eventi'),
s('The Bookseller','https://www.thebookseller.com/','Editoria Internazionale'),
s('Publishing Perspectives','https://publishingperspectives.com/','Editoria Internazionale'),
s('Federation of European Publishers','https://fep-fee.eu/','Editoria Internazionale')];
