import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import pptx2json from 'pptx2json';

const PptxReader = ({ fileUrl }) => {
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    fetch(fileUrl)
      .then((response) => response.blob())
      .then(async (blob) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const zip = await JSZip.loadAsync(e.target.result);
          const pptx = new pptx2json();
          const json = await pptx.parse(zip);
          setSlides(json.slides);
        };
        reader.readAsArrayBuffer(blob);
      })
      .catch((err) => console.error(err));
  }, [fileUrl]);

  return (
    <div>
      {slides.map((slide, index) => (
        <div key={index}>
          <h2>Slide {index + 1}</h2>
          <pre>{JSON.stringify(slide, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

export default PptxReader;
