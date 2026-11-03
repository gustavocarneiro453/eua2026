import type { Lang } from './dict'

export type TermKey = 'midterm' | 'senate' | 'house' | 'district' | 'governor' | 'electoralCollege' | 'reporting' | 'resultTypes' | 'stateLevel' | 'special' | 'majority'

type Entry = { term: string; short: string; long: string[] }

export const GLOSSARY: Record<Lang, Record<TermKey, Entry>> = {
  pt: {
    midterm: { term: 'Eleições de meio de mandato (midterms)', short: 'Eleições realizadas na metade do mandato presidencial de quatro anos. O presidente não está na cédula.', long: [
      'Acontecem dois anos depois da eleição presidencial, sempre na terça-feira seguinte à primeira segunda-feira de novembro.',
      'Funcionam como um termômetro do governo: historicamente, o partido do presidente costuma perder cadeiras no Congresso.',
      'Diferente do Brasil, não há eleição presidencial junto — mas há disputas para o Congresso, governos estaduais, legislativos locais e consultas populares.' ] },
    senate: { term: 'Senado', short: '100 senadores, dois por estado, com mandatos de seis anos. Cerca de um terço é renovado a cada dois anos.', long: [
      'Como no Brasil, cada estado tem a mesma representação no Senado, independentemente da população.',
      'O Senado confirma indicações do presidente (ministros, juízes da Suprema Corte) e ratifica tratados.',
      'A maioria é de 51 cadeiras. Em empate 50–50, o vice-presidente dá o voto de minerva.' ] },
    house: { term: 'Câmara dos Representantes', short: '435 deputados eleitos por distritos, com mandato de dois anos. Todas as cadeiras são renovadas a cada eleição.', long: [
      'O número de cadeiras por estado é proporcional à população e é recalculado após cada censo (o último foi em 2020).',
      'Diferente do Brasil, não há voto proporcional em lista: cada distrito elege um único deputado — vence quem tiver mais votos.',
      'A maioria é de 218 cadeiras. Projetos de lei de orçamento começam obrigatoriamente na Câmara.' ] },
    district: { term: 'Distrito congressional', short: 'Área geográfica que elege um deputado. Estados pouco populosos têm um único distrito "at-large".', long: [
      'Os mapas dos distritos são redesenhados periodicamente, em geral pelos legislativos estaduais — o que pode gerar disputas sobre "gerrymandering" (desenho de distritos para favorecer um partido).',
      'Alasca, Delaware, Dakota do Norte, Dakota do Sul, Vermont e Wyoming têm um único distrito.' ] },
    governor: { term: 'Governador', short: 'Chefe do Poder Executivo estadual. Em 2026, 36 estados elegem governador.', long: [
      'Os estados americanos têm grande autonomia: definem regras eleitorais, educação, polícia, impostos estaduais e boa parte da legislação penal e civil.',
      'Na maioria dos estados o mandato é de quatro anos; New Hampshire e Vermont elegem a cada dois anos.' ] },
    stateLevel: { term: 'Eleições estaduais e locais', short: 'Na mesma cédula, eleitores escolhem também legislativos estaduais, procuradores, juízes e consultas populares (ballot measures).', long: [
      'Cada estado organiza e conta a própria eleição. Não existe um órgão nacional equivalente ao TSE.',
      'Por isso, regras de votação, prazos de contagem e de certificação variam de estado para estado.' ] },
    electoralCollege: { term: 'Colégio Eleitoral', short: 'Sistema indireto usado apenas na eleição presidencial. Não está em jogo em 2026.', long: [
      'Na eleição presidencial, cada estado tem um número de delegados igual à soma de seus senadores e deputados.',
      'Em quase todos os estados, quem vence no voto popular estadual leva todos os delegados. São necessários 270 de 538 para vencer.',
      'O resultado das midterms não altera o Colégio Eleitoral, mas a distribuição de cadeiras da Câmara é a mesma base usada para calculá-lo.' ] },
    reporting: { term: 'Apuração e percentual apurado', short: 'Percentual estimado dos votos esperados que já foi contado e divulgado. Não é o percentual de urnas.', long: [
      'Nos EUA a contagem é descentralizada e pode levar dias: votos pelo correio e cédulas provisórias costumam ser contados depois.',
      'Por isso o candidato que lidera na noite da eleição pode perder quando os votos restantes forem contabilizados.',
      'Quando a fonte não informa o percentual apurado, mostramos "sem informação" — nunca zero.' ] },
    resultTypes: { term: 'Liderança, projeção, oficial e certificado', short: 'Liderar não é vencer. Projeções são estimativas da mídia; resultados oficiais e certificados vêm dos estados.', long: [
      'Liderança: o candidato tem mais votos contados até agora.',
      'Projeção: veículos e agências de dados declaram um vencedor quando consideram a vantagem matematicamente irreversível. Não tem valor legal.',
      'Oficial: resultados publicados pelas autoridades eleitorais do estado após a contagem.',
      'Certificado: o estado conclui a auditoria e certifica formalmente o resultado, geralmente semanas depois. Só exibimos "certificado" com evidência da fonte.' ] },
    special: { term: 'Eleição especial', short: 'Eleição para preencher uma vaga aberta antes do fim do mandato (por renúncia, morte ou nomeação para outro cargo).', long: [
      'Em 2026, Ohio e Flórida têm eleições especiais para o Senado, para completar os mandatos que eram de JD Vance e Marco Rubio.' ] },
    majority: { term: 'Maioria', short: 'O partido com mais da metade das cadeiras controla a pauta, as comissões e a presidência da Casa.', long: [
      'No Senado são 51 votos (ou 50 mais o voto do vice-presidente). Na Câmara, 218.',
      'Controle dividido entre Congresso e Casa Branca costuma dificultar a aprovação de leis e orçamentos.' ] },
  },
  en: {
    midterm: { term: 'Midterm elections', short: 'Elections held halfway through the four-year presidential term. The president is not on the ballot.', long: [
      'They take place two years after the presidential election, on the Tuesday after the first Monday in November.',
      'They act as a referendum on the administration: historically, the president’s party tends to lose seats in Congress.',
      'Voters also choose governors, state legislatures and ballot measures.' ] },
    senate: { term: 'Senate', short: '100 senators, two per state, serving six-year terms. About one third are up every two years.', long: [
      'Every state has equal representation regardless of population.',
      'The Senate confirms presidential nominees (cabinet, Supreme Court) and ratifies treaties.',
      'A majority is 51 seats. In a 50–50 tie, the Vice President casts the deciding vote.' ] },
    house: { term: 'House of Representatives', short: '435 members elected by district for two-year terms. Every seat is up each cycle.', long: [
      'Seats are apportioned among states by population and recalculated after each census (most recently 2020).',
      'Each district elects a single member by plurality vote.',
      'A majority is 218 seats. Revenue bills must originate in the House.' ] },
    district: { term: 'Congressional district', short: 'A geographic area that elects one representative. Small states have a single at-large district.', long: [
      'District maps are redrawn periodically, usually by state legislatures, which can lead to disputes over gerrymandering.',
      'Alaska, Delaware, North Dakota, South Dakota, Vermont and Wyoming each have one at-large district.' ] },
    governor: { term: 'Governor', short: 'Head of a state’s executive branch. 36 states elect a governor in 2026.', long: [
      'US states are highly autonomous: they set election rules, education, policing, state taxes and much civil and criminal law.',
      'Most terms are four years; New Hampshire and Vermont elect every two years.' ] },
    stateLevel: { term: 'State and local elections', short: 'The same ballot includes state legislatures, attorneys general, judges and ballot measures.', long: [
      'Each state runs and counts its own election; there is no single national election authority.',
      'Voting rules, counting timelines and certification deadlines therefore vary by state.' ] },
    electoralCollege: { term: 'Electoral College', short: 'Indirect system used only for presidential elections. Not at stake in 2026.', long: [
      'Each state gets electors equal to its senators plus representatives.',
      'In almost every state the statewide popular-vote winner takes all electors. 270 of 538 are needed to win.',
      'Midterms do not change the Electoral College, but House apportionment is the same basis used to size it.' ] },
    reporting: { term: 'Vote count and percent reporting', short: 'Estimated share of the expected vote that has been counted and released. Not a share of precincts.', long: [
      'Counting is decentralized and can take days: mail and provisional ballots are often counted later.',
      'The candidate leading on election night may lose once remaining ballots are counted.',
      'When the source does not provide percent reporting we show “unknown” — never zero.' ] },
    resultTypes: { term: 'Leading, projected, official and certified', short: 'Leading is not winning. Projections are media estimates; official and certified results come from states.', long: [
      'Leading: the candidate has the most votes counted so far.',
      'Projected: news and data organizations call a winner when they judge the lead insurmountable. It has no legal standing.',
      'Official: results published by state election authorities after counting.',
      'Certified: the state completes its canvass and formally certifies results, usually weeks later. We only show “certified” with source evidence.' ] },
    special: { term: 'Special election', short: 'An election to fill a seat vacated before the end of its term (resignation, death or appointment elsewhere).', long: [
      'In 2026, Ohio and Florida hold special Senate elections for the seats formerly held by JD Vance and Marco Rubio.' ] },
    majority: { term: 'Majority', short: 'The party holding more than half the seats controls the agenda, committees and chamber leadership.', long: [
      'In the Senate that is 51 votes (or 50 plus the Vice President). In the House, 218.',
      'Split control between Congress and the White House usually makes passing laws and budgets harder.' ] },
  },
}
