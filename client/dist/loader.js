// Function to show the loader
function showLoader() {
    const loader = document.createElement('div');
    loader.id = 'loader-wrapper';
    loader.innerHTML = `
      <div class="loader"></div>
    `;
    document.body.appendChild(loader);
  }
  
  // Function to hide the loader
  function hideLoader() {
    const loader = document.getElementById('loader-wrapper');
    if (loader) {
      loader.remove();
    }
  }
  
  // Initialize loader styles
  function initLoaderStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      /* Loader Styles */
      #loader-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }
  
      .loader {
        border: 8px solid #f3f3f3; /* Light grey */
        border-top: 8px solid #3498db; /* Blue */
        border-radius: 50%;
        width: 60px;
        height: 60px;
        animation: spin 1s linear infinite;
      }
  
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Call this function once to initialize the loader styles
  initLoaderStyles();
  