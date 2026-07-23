import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { Link } from 'react-router-dom';
import { LuDownload } from 'react-icons/lu';

const DocxReader = ({ fileUrl }) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(fileUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          mammoth.convertToHtml({ arrayBuffer: e.target.result })
            .then((result) => setContent(result.value))
            .catch((err) => console.error(err));
        };
        reader.readAsArrayBuffer(blob);
      })
      .catch((err) => console.error(err));
  }, [fileUrl]);

  return <div>
    <Link download={true} to={fileUrl} className='p-2 rounded bg-primary hover:bg-primary text-white flex items-center justify-center'>
    <LuDownload/>
    Télécharger le document
    </Link>
    <div className='max-h-[80vh] overflow-auto p-2 rounded-lg' dangerouslySetInnerHTML={{ __html: content }} />
  </div>;
};

export default DocxReader;
