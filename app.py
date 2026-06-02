import streamlit as st
import streamlit.components.v1 as components

# Set page title and layout
st.set_page_config(
    page_title="Social Media Usage Analysis Dashboard",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Load the premium Social Media Usage Analysis Dashboard HTML file
try:
    with open("social-media-dashboard.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # Render the dashboard inside Streamlit
    components.html(html_content, height=1800, scrolling=True)
    
except FileNotFoundError:
    st.error("Error: 'social-media-dashboard.html' not found in the root directory. Please make sure the file exists.")
