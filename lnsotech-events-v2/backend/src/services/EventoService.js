const EventoRepository = require('../repositories/EventoRepository');
const fs = require('fs');
const path = require('path');

class EventoService {
    async listarEventos(search) {
        return await EventoRepository.findAll(search);
    }

    async obterEstatisticas() {
        return await EventoRepository.getStats();
    }

    async criarEvento(dados) {
        return await EventoRepository.create(dados);
    }

    async atualizarEvento(id, dados, usuarioId) {
        const oldState = await EventoRepository.findById(id);
        if (!oldState) throw new Error('Evento não encontrado');

        await EventoRepository.update(id, dados);
        await EventoRepository.addHistorico(id, usuarioId, oldState, dados);
    }

    async eliminarEvento(id) {
        await EventoRepository.delete(id);
    }

    async atualizarFoto(id, filename) {
        const fotoUrl = `/uploads/${filename}`;
        await EventoRepository.updateFoto(id, fotoUrl);
        return fotoUrl;
    }

    async gerarCSV(eventos) {
        const csvRows = ['ID,Nomes,Data,Tipo,Grupo,Foto,Criado Em'];
        eventos.forEach(r => {
            const rowStr = `${r.id},"${r.nomes_principais}",${new Date(r.data_evento).toLocaleDateString()},${r.tipo_evento},"${r.grupo_id || 'N/A'}","${r.foto_url || ''}",${new Date(r.criado_em).toLocaleDateString()}`;
            csvRows.push(rowStr);
        });
        return csvRows.join('\n');
    }

    async gerarICal() {
        const rows = await EventoRepository.findAll();
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//LNSOTECH Events CRM//PT',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Eventos LNSOTECH',
            'X-WR-TIMEZONE:Africa/Maputo',
            'X-WR-CALDESC:Sincronização automática de eventos CRM LNSOTECH'
        ];

        rows.forEach(ev => {
            const dateObj = new Date(ev.data_evento);
            const freq = ev.frequencia_lembrete || 'anual';
            const yearStr = dateObj.getFullYear();
            const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dateObj.getDate()).padStart(2, '0');
            const dtStart = `${yearStr}${monthStr}${dayStr}`;
            
            let rrule = '';
            if (freq === 'anual') rrule = 'RRULE:FREQ=YEARLY';
            else if (freq === 'mensal') rrule = 'RRULE:FREQ=MONTHLY';
            else if (freq === 'semanal') rrule = 'RRULE:FREQ=WEEKLY';
            else if (freq === 'diario') rrule = 'RRULE:FREQ=DAILY';

            const summary = ev.tipo_evento === 'casamento' 
                ? `Bodas: ${ev.nomes_principais}` 
                : `${ev.tipo_evento?.charAt(0).toUpperCase() + ev.tipo_evento?.slice(1)}: ${ev.nomes_principais}`;

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:lnso-evento-${ev.id}@lnsotech.com`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                `DTSTART;VALUE=DATE:${dtStart}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:Grupo WhatsApp associado: ${ev.grupo_id || 'N/A'}\\nFrequência: ${freq}`,
                rrule,
                'STATUS:CONFIRMED',
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');
        return icsContent.join('\r\n');
    }

    async importarCSV(filepath) {
        const csvContent = fs.readFileSync(filepath, 'utf-8');
        const lines = csvContent.split('\n').filter(l => l.trim());
        const startIndex = lines[0].toLowerCase().includes('nome') ? 1 : 0;
        
        let imported = 0;
        let errors = 0;

        for (let i = startIndex; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
            if (cols.length < 2) { errors++; continue; }
            
            try {
                await EventoRepository.create({
                    nomes_principais: cols[0],
                    data_evento: cols[1],
                    tipo_evento: cols[2] || 'casamento',
                    grupo_id: cols[3] || 'Importacao_CSV'
                });
                imported++;
            } catch (e) {
                errors++;
            }
        }
        return { imported, errors };
    }
}

module.exports = new EventoService();
