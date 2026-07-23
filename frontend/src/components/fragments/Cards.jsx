import React, { useEffect, useState } from 'react';
import Card from '../Card';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint } from 'react-icons/fa6';
import { countDocument } from '../../api/routes/document';

function Cards() {
    const [docCounts, setDocCounts] = useState({});

    async function fetchDocCounts() {
        try {
            const res = await countDocument();
            if (res.status === 200) {
                const { counts } = await res.json();
                setDocCounts(counts);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des documents:', error);
        }
    }

    useEffect(() => {
        fetchDocCounts();
    }, []);

    return (
        <div className='grid md:grid-cols-3 flex-grow-0 sm:grid-cols-2 xl:grid-cols-4 grid-cols-1 gap-5 mb-8'>
            <Card>
                <div className='flex flex-col items-start gap-2'>
                    <div className='flex items-center gap-3'>
                        <div className='bg-primary p-2 rounded text-white'>
                            <FaFileWord size={25} />
                        </div>
                        <div>
                            <p className='text-lg font-semibold'>Fichier Words</p>
                            <p>{(docCounts.docx || 0) + (docCounts.doc || 0)}</p>
                        </div>
                    </div>
                </div>
            </Card>
            <Card>
                <div className='flex flex-col items-start gap-2'>
                    <div className='flex items-center gap-3'>
                        <div className='bg-primary p-2 rounded text-white'>
                            <FaFileExcel size={25} />
                        </div>
                        <div>
                            <p className='text-lg font-semibold'>Fichier Excels</p>
                            <p>{(docCounts.xls || 0) + (docCounts.xlsx || 0) + (docCounts.csv || 0)}</p>
                        </div>
                    </div>
                </div>
            </Card>
            <Card>
                <div className='flex flex-col items-start gap-2'>
                    <div className='flex items-center gap-3'>
                        <div className='bg-primary p-2 rounded text-white'>
                            <FaFilePowerpoint size={25} />
                        </div>
                        <div>
                            <p className='text-lg font-semibold'>Fichier PowerPoints</p>
                            <p>{(docCounts.ppt || 0) + (docCounts.pptx || 0)}</p>
                        </div>
                    </div>
                </div>
            </Card>
            <Card>
                <div className='flex flex-col items-start gap-2'>
                    <div className='flex items-center gap-3'>
                        <div className='bg-primary p-2 rounded text-white'>
                            <FaFilePdf size={25} />
                        </div>
                        <div>
                            <p className='text-lg font-semibold'>Fichier Pdf</p>
                            <p>{docCounts.pdf || 0}</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

export default Cards;
