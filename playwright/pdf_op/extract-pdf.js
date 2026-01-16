/**
 * Script para extrair "Descrição longa do item" de PDFs da Petronect
 * Uso: node extract-pdf.js <arquivo.pdf>
 */

const fs = require('fs');
const path = require('path');
const { PDFExtract } = require('pdf.js-extract');

async function extractDescricaoLonga(pdfPath) {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(pdfPath)) {
      console.error(`Arquivo não encontrado: ${pdfPath}`);
      return null;
    }

    // Ler o PDF
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extract(pdfPath, {});

    // Juntar todo o texto de todas as páginas
    let text = '';
    for (const page of data.pages) {
      for (const item of page.content) {
        if (item.str) {
          text += item.str + ' ';
        }
      }
      text += '\n';
    }
    console.log('=== Texto extraído do PDF ===\n');

    // Extrair número da oportunidade
    const opMatch = text.match(/Número da Oportunidade\s*(\d+)/);
    const numeroOp = opMatch ? opMatch[1] : 'N/A';

    // Extrair nome da oportunidade
    const nomeMatch = text.match(/Nome da Oportunidade\s*([^\n]+)/);
    const nomeOp = nomeMatch ? nomeMatch[1].trim() : 'N/A';

    // Extrair todas as descrições longas dos itens
    // O padrão é: "Descrição longa do item" seguido pelo texto até a próxima seção
    const descricoesLongas = [];

    // Regex para capturar "Descrição longa do item" e seu conteúdo
    const regex = /Descrição longa do item\s*([^]*?)(?=Declarações envolvidas|Dados do Item \d+|$)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      let descricao = match[1].trim();
      // Limpar quebras de linha extras e espaços
      descricao = descricao.replace(/\s+/g, ' ').trim();
      if (descricao && descricao.length > 10) {
        descricoesLongas.push(descricao);
      }
    }

    // Se não encontrou com o regex acima, tentar outra abordagem
    if (descricoesLongas.length === 0) {
      const lines = text.split('\n');
      let captureNext = false;
      let currentDesc = '';

      for (const line of lines) {
        if (line.includes('Descrição longa do item')) {
          captureNext = true;
          // Verificar se a descrição está na mesma linha
          const parts = line.split('Descrição longa do item');
          if (parts[1] && parts[1].trim()) {
            currentDesc = parts[1].trim();
          }
          continue;
        }

        if (captureNext) {
          if (line.includes('Declarações') || line.includes('Dados do Item') || line.match(/^\d+\s+[A-Z]/)) {
            if (currentDesc) {
              descricoesLongas.push(currentDesc.trim());
              currentDesc = '';
            }
            captureNext = false;
          } else {
            currentDesc += ' ' + line.trim();
          }
        }
      }

      if (currentDesc) {
        descricoesLongas.push(currentDesc.trim());
      }
    }

    // Montar resultado
    const resultado = {
      arquivo: path.basename(pdfPath),
      numeroOportunidade: numeroOp,
      nomeOportunidade: nomeOp,
      dataExtracao: new Date().toLocaleString('pt-BR'),
      itens: descricoesLongas.map((desc, idx) => ({
        item: idx + 1,
        descricaoLonga: desc
      }))
    };

    return resultado;

  } catch (error) {
    console.error('Erro ao processar PDF:', error.message);
    return null;
  }
}

async function main() {
  // Pegar o arquivo PDF do argumento ou usar o padrão
  const pdfFile = process.argv[2] || 'OP_04.pdf';
  const pdfPath = path.resolve(__dirname, pdfFile);

  console.log(`Processando: ${pdfPath}\n`);

  const resultado = await extractDescricaoLonga(pdfPath);

  if (resultado) {
    // Criar conteúdo do TXT
    let txtContent = `========================================\n`;
    txtContent += `EXTRAÇÃO DE DADOS - PETRONECT\n`;
    txtContent += `========================================\n\n`;
    txtContent += `Arquivo: ${resultado.arquivo}\n`;
    txtContent += `Número da Oportunidade: ${resultado.numeroOportunidade}\n`;
    txtContent += `Nome: ${resultado.nomeOportunidade}\n`;
    txtContent += `Data da Extração: ${resultado.dataExtracao}\n\n`;
    txtContent += `----------------------------------------\n`;
    txtContent += `DESCRIÇÕES LONGAS DOS ITENS\n`;
    txtContent += `----------------------------------------\n\n`;

    if (resultado.itens.length === 0) {
      txtContent += `Nenhuma descrição longa encontrada.\n`;
    } else {
      resultado.itens.forEach(item => {
        txtContent += `Item ${item.item}:\n`;
        txtContent += `${item.descricaoLonga}\n\n`;
      });
    }

    // Salvar o arquivo TXT
    const txtFileName = pdfFile.replace('.pdf', '_descricao.txt');
    const txtPath = path.resolve(__dirname, txtFileName);

    fs.writeFileSync(txtPath, txtContent, 'utf8');

    console.log('=== RESULTADO ===\n');
    console.log(txtContent);
    console.log(`\nArquivo salvo em: ${txtPath}`);
  }
}

main();
