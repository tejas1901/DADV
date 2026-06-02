# =========================================================
# AI SOCIAL MEDIA USAGE ANALYSIS SYSTEM — ADVANCED
# Mini Project | Python + Streamlit + ML
#
# Install:
# pip install pandas numpy matplotlib seaborn scikit-learn textblob streamlit plotly
#
# Run:
# streamlit run social_media_analysis.py
# =========================================================

import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, roc_curve, auc
)
from textblob import TextBlob
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# PAGE CONFIG & LIGHT THEME
# ─────────────────────────────────────────────

st.set_page_config(
    page_title="Social Media Analysis",
    page_icon="📱",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Light theme CSS
st.markdown("""
<style>
    /* Force light background */
    .stApp { background-color: #f5f7fa; color: #1a1a2e; }
    .block-container { padding: 1.5rem 2rem 2rem 2rem; }

    /* Card style for metrics */
    div[data-testid="metric-container"] {
        background: white;
        border-radius: 12px;
        padding: 18px 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        border-left: 4px solid #4f8ef7;
    }

    /* Section headers */
    h2 { color: #1a1a2e !important; border-bottom: 2px solid #4f8ef7; padding-bottom: 6px; }
    h3 { color: #2d2d5e !important; }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background: #ffffff;
        border-right: 1px solid #e0e4ea;
    }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] { gap: 8px; }
    .stTabs [data-baseweb="tab"] {
        background: #e9eef6;
        border-radius: 8px 8px 0 0;
        padding: 6px 18px;
        color: #333;
        font-weight: 500;
    }
    .stTabs [aria-selected="true"] {
        background: #4f8ef7 !important;
        color: white !important;
    }

    /* Buttons */
    div.stButton > button {
        background: #4f8ef7;
        color: white;
        border-radius: 8px;
        border: none;
        padding: 8px 22px;
        font-weight: 600;
        width: 100%;
    }
    div.stButton > button:hover { background: #2d6fd6; }

    /* Slider label */
    label { color: #333 !important; font-weight: 500; }

    /* Dataframe */
    .dataframe { font-size: 13px; }

    /* Success / warning / error */
    .stSuccess, .stInfo, .stWarning, .stError {
        border-radius: 10px !important;
    }
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────
# HEADER
# ─────────────────────────────────────────────

st.markdown("# 📱 AI Social Media Usage Analysis System")
st.markdown(
    "**An intelligent dashboard to analyse screen time, detect addiction risk, "
    "understand productivity impact, and predict user behaviour using Machine Learning.**"
)
st.markdown("---")

# ─────────────────────────────────────────────
# DATA GENERATION
# ─────────────────────────────────────────────

@st.cache_data
def generate_data(n=500, seed=42):
    np.random.seed(seed)
    platforms  = ["Instagram", "YouTube", "Twitter", "Facebook", "LinkedIn", "TikTok"]
    age_groups = ["Teen (13-17)", "Young Adult (18-25)", "Adult (26-35)", "Senior (36+)"]
    genders    = ["Male", "Female", "Non-binary"]
    occupations = ["Student", "Professional", "Freelancer", "Unemployed"]

    ages = np.random.randint(13, 45, n)
    usage = np.round(np.random.uniform(0.5, 12, n), 2)
    sleep = np.round(np.random.normal(6.8, 1.2, n).clip(3, 10), 1)
    productivity = np.clip(np.round(10 - usage * 0.6 + np.random.normal(0, 1.5, n)), 1, 10).astype(int)
    notifications = np.random.randint(10, 400, n)
    likes    = np.random.randint(5, 600, n)
    comments = np.random.randint(0, 150, n)
    messages = np.random.randint(5, 350, n)
    sessions = np.random.randint(1, 25, n)

    df = pd.DataFrame({
        "Age": ages,
        "Age_Group": pd.cut(
            ages,
            bins=[12, 17, 25, 35, 100],
            labels=age_groups
        ).astype(str),
        "Gender": np.random.choice(genders, n),
        "Occupation": np.random.choice(occupations, n),
        "Platform": np.random.choice(platforms, n),
        "Daily_Usage_Hours": usage,
        "Sessions_Per_Day": sessions,
        "Posts_Liked_Per_Day": likes,
        "Comments_Per_Day": comments,
        "Messages_Sent": messages,
        "Notifications_Received": notifications,
        "Sleep_Hours": sleep,
        "Productivity_Score": productivity,
    })

    # Addiction score
    df["Addiction_Score"] = np.clip(
        df["Daily_Usage_Hours"] * 2
        + df["Posts_Liked_Per_Day"] / 60
        + df["Messages_Sent"] / 50
        + df["Sessions_Per_Day"] * 0.3
        - df["Sleep_Hours"] * 0.8,
        0, 30
    ).round(2)

    df["Addiction_Level"] = pd.cut(
        df["Addiction_Score"],
        bins=[-1, 10, 18, 30],
        labels=["Low", "Moderate", "High"]
    )
    df["Addicted"] = np.where(df["Addiction_Score"] > 18, 1, 0)

    # Screen health score (0-100)
    df["Screen_Health_Score"] = np.clip(
        100
        - df["Daily_Usage_Hours"] * 6
        + df["Sleep_Hours"] * 3
        + df["Productivity_Score"] * 1.5,
        0, 100
    ).round(1)

    # Sample sentiments
    posts = [
        "I love spending time on social media!",
        "Feeling drained from endless scrolling.",
        "Great content today, feeling inspired!",
        "Sad and anxious after checking my feed.",
        "Learned something new today online.",
        "People are so negative these days.",
        "Connected with old friends, feeling happy!",
        "Can't stop using my phone, it's a problem.",
    ]
    df["User_Post"] = np.random.choice(posts, n)
    df["Sentiment"] = df["User_Post"].apply(
        lambda t: "Positive" if TextBlob(t).sentiment.polarity > 0
        else ("Negative" if TextBlob(t).sentiment.polarity < 0 else "Neutral")
    )
    df["Polarity"] = df["User_Post"].apply(lambda t: round(TextBlob(t).sentiment.polarity, 3))

    return df

df = generate_data()

# ─────────────────────────────────────────────
# SIDEBAR FILTERS
# ─────────────────────────────────────────────

st.sidebar.image("https://img.icons8.com/fluency/96/smartphone.png", width=60)
st.sidebar.markdown("## 🔍 Filters & Settings")

platforms_list = ["All"] + sorted(df["Platform"].unique().tolist())
sel_platform = st.sidebar.selectbox("📌 Platform", platforms_list)

age_groups_list = ["All"] + sorted(df["Age_Group"].unique().tolist())
sel_age = st.sidebar.selectbox("👤 Age Group", age_groups_list)

occupations_list = ["All"] + sorted(df["Occupation"].unique().tolist())
sel_occ = st.sidebar.selectbox("💼 Occupation", occupations_list)

usage_range = st.sidebar.slider(
    "⏱ Daily Usage Hours (range)", 0.0, 12.0, (0.0, 12.0), step=0.5
)

st.sidebar.markdown("---")
st.sidebar.markdown("### 📊 Dataset Info")
st.sidebar.info(f"Total Records: **{len(df)}**\nPlatforms: **{df['Platform'].nunique()}**")

# Apply filters
filtered = df.copy()
if sel_platform != "All":
    filtered = filtered[filtered["Platform"] == sel_platform]
if sel_age != "All":
    filtered = filtered[filtered["Age_Group"] == sel_age]
if sel_occ != "All":
    filtered = filtered[filtered["Occupation"] == sel_occ]
filtered = filtered[
    (filtered["Daily_Usage_Hours"] >= usage_range[0]) &
    (filtered["Daily_Usage_Hours"] <= usage_range[1])
]

# ─────────────────────────────────────────────
# TABS
# ─────────────────────────────────────────────

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📊 Overview",
    "🤖 ML Models",
    "📈 Deep Analysis",
    "😊 Sentiment",
    "🧠 Live Predictor"
])

# ════════════════════════════════════════════════════════
# TAB 1 — OVERVIEW
# ════════════════════════════════════════════════════════
with tab1:
    st.markdown("## 📊 Key Performance Indicators")

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("👥 Users", len(filtered))
    c2.metric("⏱ Avg Usage (hrs)", round(filtered["Daily_Usage_Hours"].mean(), 2))
    c3.metric("🔥 Avg Addiction Score", round(filtered["Addiction_Score"].mean(), 2))
    c4.metric("😴 Avg Sleep (hrs)", round(filtered["Sleep_Hours"].mean(), 2))
    c5.metric("⚡ Avg Productivity", round(filtered["Productivity_Score"].mean(), 2))

    st.markdown("---")
    st.markdown("## 📋 Dataset Preview")
    st.dataframe(
        filtered[[
            "Age", "Gender", "Occupation", "Platform",
            "Daily_Usage_Hours", "Sleep_Hours",
            "Productivity_Score", "Addiction_Score",
            "Addiction_Level", "Screen_Health_Score", "Sentiment"
        ]].head(25),
        use_container_width=True
    )

    st.markdown("---")
    left, right = st.columns(2)

    with left:
        st.markdown("### 📱 Usage by Platform")
        platform_avg = (
            filtered.groupby("Platform")["Daily_Usage_Hours"]
            .mean().reset_index().sort_values("Daily_Usage_Hours", ascending=False)
        )
        fig_p = px.bar(
            platform_avg, x="Platform", y="Daily_Usage_Hours",
            color="Daily_Usage_Hours",
            color_continuous_scale="Blues",
            labels={"Daily_Usage_Hours": "Avg Hours"},
            template="simple_white"
        )
        fig_p.update_layout(coloraxis_showscale=False)
        st.plotly_chart(fig_p, use_container_width=True)

    with right:
        st.markdown("### 🎯 Addiction Level Distribution")
        lvl_counts = filtered["Addiction_Level"].value_counts().reset_index()
        lvl_counts.columns = ["Level", "Count"]
        color_map = {"Low": "#4CAF50", "Moderate": "#FF9800", "High": "#F44336"}
        fig_l = px.pie(
            lvl_counts, names="Level", values="Count",
            color="Level", color_discrete_map=color_map,
            hole=0.4, template="simple_white"
        )
        st.plotly_chart(fig_l, use_container_width=True)

    left2, right2 = st.columns(2)
    with left2:
        st.markdown("### 📅 Weekly Usage Trend")
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        usage_wk = np.round(np.random.uniform(3, 9, 7), 2)
        wk_df = pd.DataFrame({"Day": days, "Usage": usage_wk})
        fig_wk = px.line(
            wk_df, x="Day", y="Usage", markers=True,
            template="simple_white",
            labels={"Usage": "Avg Hours"},
            color_discrete_sequence=["#4f8ef7"]
        )
        fig_wk.update_traces(line_width=2.5)
        st.plotly_chart(fig_wk, use_container_width=True)

    with right2:
        st.markdown("### 🌡️ Screen Health Score Distribution")
        fig_sh = px.histogram(
            filtered, x="Screen_Health_Score", nbins=25,
            color_discrete_sequence=["#43a047"],
            template="simple_white",
            labels={"Screen_Health_Score": "Health Score (0-100)"}
        )
        st.plotly_chart(fig_sh, use_container_width=True)

# ════════════════════════════════════════════════════════
# TAB 2 — ML MODELS
# ════════════════════════════════════════════════════════
with tab2:
    st.markdown("## 🤖 Machine Learning Models")

    features = [
        "Age", "Daily_Usage_Hours", "Posts_Liked_Per_Day",
        "Comments_Per_Day", "Messages_Sent", "Sleep_Hours",
        "Productivity_Score", "Sessions_Per_Day", "Notifications_Received"
    ]

    X = df[features]
    y = df["Addicted"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Train three models
    models = {
        "Random Forest":        RandomForestClassifier(n_estimators=150, random_state=42),
        "Gradient Boosting":    GradientBoostingClassifier(n_estimators=100, random_state=42),
        "Logistic Regression":  LogisticRegression(max_iter=500, random_state=42),
    }

    results = {}
    for name, m in models.items():
        m.fit(X_train, y_train)
        preds = m.predict(X_test)
        cv    = cross_val_score(m, X, y, cv=5).mean()
        results[name] = {
            "model":    m,
            "accuracy": accuracy_score(y_test, preds),
            "cv_score": cv,
            "preds":    preds,
        }

    # Model comparison
    st.markdown("### 📊 Model Accuracy Comparison")
    comp_df = pd.DataFrame({
        "Model":    list(results.keys()),
        "Test Accuracy (%)": [round(v["accuracy"]*100, 2) for v in results.values()],
        "CV Score (%)":       [round(v["cv_score"]*100, 2) for v in results.values()],
    })
    st.dataframe(comp_df, use_container_width=True, hide_index=True)

    best_name = max(results, key=lambda k: results[k]["accuracy"])
    best = results[best_name]
    st.success(f"✅ Best Model: **{best_name}** — Accuracy: **{round(best['accuracy']*100, 2)}%**")

    col_a, col_b = st.columns(2)

    with col_a:
        st.markdown("### 📌 Feature Importance")
        rf_model = results["Random Forest"]["model"]
        imp_df = pd.DataFrame({
            "Feature": features,
            "Importance": rf_model.feature_importances_
        }).sort_values("Importance", ascending=True)
        fig_imp = px.bar(
            imp_df, x="Importance", y="Feature",
            orientation="h",
            color="Importance",
            color_continuous_scale="Blues",
            template="simple_white"
        )
        fig_imp.update_layout(coloraxis_showscale=False, yaxis_title="")
        st.plotly_chart(fig_imp, use_container_width=True)

    with col_b:
        st.markdown("### 🟦 Confusion Matrix")
        cm = confusion_matrix(y_test, best["preds"])
        fig_cm = px.imshow(
            cm,
            labels={"x": "Predicted", "y": "Actual", "color": "Count"},
            x=["Not Addicted", "Addicted"],
            y=["Not Addicted", "Addicted"],
            text_auto=True,
            color_continuous_scale="Blues",
            template="simple_white"
        )
        st.plotly_chart(fig_cm, use_container_width=True)

    # ROC Curve
    st.markdown("### 📉 ROC Curves (All Models)")
    fig_roc = go.Figure()
    for name, res in results.items():
        m = res["model"]
        if hasattr(m, "predict_proba"):
            proba = m.predict_proba(X_test)[:, 1]
        else:
            proba = m.decision_function(X_test)
        fpr, tpr, _ = roc_curve(y_test, proba)
        roc_auc = auc(fpr, tpr)
        fig_roc.add_trace(go.Scatter(
            x=fpr, y=tpr, mode="lines",
            name=f"{name} (AUC={round(roc_auc, 3)})"
        ))
    fig_roc.add_trace(go.Scatter(
        x=[0,1], y=[0,1], mode="lines",
        line=dict(dash="dash", color="gray"),
        name="Random Chance"
    ))
    fig_roc.update_layout(
        xaxis_title="False Positive Rate",
        yaxis_title="True Positive Rate",
        template="simple_white",
        legend=dict(x=0.55, y=0.1)
    )
    st.plotly_chart(fig_roc, use_container_width=True)

    # Classification report
    st.markdown("### 📋 Classification Report (Best Model)")
    report = classification_report(y_test, best["preds"], output_dict=True)
    report_df = pd.DataFrame(report).T.drop(columns=["support"], errors="ignore")
    st.dataframe(report_df.round(3), use_container_width=True)

# ════════════════════════════════════════════════════════
# TAB 3 — DEEP ANALYSIS
# ════════════════════════════════════════════════════════
with tab3:
    st.markdown("## 📈 Deep Behavioural Analysis")

    c1, c2 = st.columns(2)

    with c1:
        st.markdown("### 🔥 Correlation Heatmap")
        num_cols = [
            "Age", "Daily_Usage_Hours", "Sleep_Hours",
            "Productivity_Score", "Addiction_Score",
            "Screen_Health_Score", "Sessions_Per_Day"
        ]
        corr = filtered[num_cols].corr()
        fig_heat = px.imshow(
            corr, text_auto=".2f",
            color_continuous_scale="RdBu_r",
            template="simple_white",
            aspect="auto"
        )
        st.plotly_chart(fig_heat, use_container_width=True)

    with c2:
        st.markdown("### ⚡ Productivity vs Usage (by Occupation)")
        fig_sc = px.scatter(
            filtered, x="Daily_Usage_Hours", y="Productivity_Score",
            color="Occupation", size="Addiction_Score",
            opacity=0.7, template="simple_white",
            labels={"Daily_Usage_Hours": "Daily Usage (hrs)"},
            hover_data=["Platform", "Age", "Sleep_Hours"]
        )
        st.plotly_chart(fig_sc, use_container_width=True)

    c3, c4 = st.columns(2)

    with c3:
        st.markdown("### 😴 Sleep vs Addiction Score")
        fig_sl = px.scatter(
            filtered, x="Sleep_Hours", y="Addiction_Score",
            color="Addiction_Level",
            color_discrete_map={"Low": "#4CAF50", "Moderate": "#FF9800", "High": "#F44336"},
            template="simple_white",
            opacity=0.7,
            trendline="ols"
        )
        st.plotly_chart(fig_sl, use_container_width=True)

    with c4:
        st.markdown("### 📊 Usage Distribution by Age Group")
        fig_vio = px.violin(
            filtered, x="Age_Group", y="Daily_Usage_Hours",
            color="Age_Group", box=True, points="outliers",
            template="simple_white"
        )
        fig_vio.update_layout(showlegend=False)
        st.plotly_chart(fig_vio, use_container_width=True)

    st.markdown("### 🧮 Platform × Addiction Level Breakdown")
    cross = pd.crosstab(filtered["Platform"], filtered["Addiction_Level"], normalize="index") * 100
    cross = cross.reset_index()
    cross_melted = cross.melt(id_vars="Platform", var_name="Addiction Level", value_name="Percentage")
    fig_stk = px.bar(
        cross_melted, x="Platform", y="Percentage",
        color="Addiction Level",
        barmode="stack",
        color_discrete_map={"Low": "#4CAF50", "Moderate": "#FF9800", "High": "#F44336"},
        template="simple_white",
        labels={"Percentage": "% of Users"}
    )
    st.plotly_chart(fig_stk, use_container_width=True)

# ════════════════════════════════════════════════════════
# TAB 4 — SENTIMENT
# ════════════════════════════════════════════════════════
with tab4:
    st.markdown("## 😊 Sentiment & Emotional Analysis")

    c1, c2 = st.columns(2)

    with c1:
        st.markdown("### 😊 Sentiment Distribution")
        sent_counts = filtered["Sentiment"].value_counts().reset_index()
        sent_counts.columns = ["Sentiment", "Count"]
        color_sent = {"Positive": "#4CAF50", "Neutral": "#9E9E9E", "Negative": "#F44336"}
        fig_sent = px.pie(
            sent_counts, names="Sentiment", values="Count",
            color="Sentiment", color_discrete_map=color_sent,
            hole=0.45, template="simple_white"
        )
        st.plotly_chart(fig_sent, use_container_width=True)

    with c2:
        st.markdown("### 🔀 Sentiment by Platform")
        sent_plat = filtered.groupby(["Platform", "Sentiment"]).size().reset_index(name="Count")
        fig_sp = px.bar(
            sent_plat, x="Platform", y="Count",
            color="Sentiment", barmode="group",
            color_discrete_map=color_sent,
            template="simple_white"
        )
        st.plotly_chart(fig_sp, use_container_width=True)

    st.markdown("### 📉 Polarity Score Distribution")
    fig_pol = px.histogram(
        filtered, x="Polarity", nbins=30,
        color_discrete_sequence=["#4f8ef7"],
        template="simple_white",
        labels={"Polarity": "Sentiment Polarity (-1 = Negative, +1 = Positive)"}
    )
    st.plotly_chart(fig_pol, use_container_width=True)

    # Insight table
    st.markdown("### 📋 Sentiment Insight Summary")
    insight_rows = []
    for plat in filtered["Platform"].unique():
        sub = filtered[filtered["Platform"] == plat]
        pos = round(sub[sub["Sentiment"] == "Positive"].shape[0] / len(sub) * 100, 1)
        neg = round(sub[sub["Sentiment"] == "Negative"].shape[0] / len(sub) * 100, 1)
        avg_pol = round(sub["Polarity"].mean(), 3)
        insight_rows.append({
            "Platform": plat, "Positive %": pos,
            "Negative %": neg, "Avg Polarity": avg_pol
        })
    ins_df = pd.DataFrame(insight_rows).sort_values("Avg Polarity", ascending=False)
    st.dataframe(ins_df, use_container_width=True, hide_index=True)

# ════════════════════════════════════════════════════════
# TAB 5 — LIVE PREDICTOR
# ════════════════════════════════════════════════════════
with tab5:
    st.markdown("## 🧠 Live Addiction Risk Predictor")
    st.info("Fill in the sliders below and click **Predict** to instantly assess addiction risk.")

    col1, col2, col3 = st.columns(3)

    with col1:
        u_age         = st.slider("🧑 Age", 13, 50, 22)
        u_usage       = st.slider("⏱ Daily Usage (hrs)", 0.5, 15.0, 5.0, step=0.5)
        u_sessions    = st.slider("📲 Sessions Per Day", 1, 30, 8)

    with col2:
        u_likes       = st.slider("❤️ Likes Per Day", 0, 600, 100)
        u_comments    = st.slider("💬 Comments Per Day", 0, 150, 20)
        u_messages    = st.slider("📩 Messages Sent", 0, 350, 50)

    with col3:
        u_notifications = st.slider("🔔 Notifications Received", 0, 400, 80)
        u_sleep       = st.slider("😴 Sleep Hours", 1.0, 10.0, 7.0, step=0.5)
        u_productivity = st.slider("⚡ Productivity Score (1-10)", 1, 10, 5)

    st.markdown("")
    if st.button("🔍 Predict Addiction Risk"):
        input_arr = np.array([[
            u_age, u_usage, u_likes, u_comments,
            u_messages, u_sleep, u_productivity,
            u_sessions, u_notifications
        ]])

        rf_m = results["Random Forest"]["model"]
        pred  = rf_m.predict(input_arr)[0]
        proba = rf_m.predict_proba(input_arr)[0][1]

        # Derived insight scores
        raw_addiction = (
            u_usage * 2
            + u_likes / 60
            + u_messages / 50
            + u_sessions * 0.3
            - u_sleep * 0.8
        )
        health_score = max(0, min(100,
            100 - u_usage * 6 + u_sleep * 3 + u_productivity * 1.5
        ))

        st.markdown("---")
        st.markdown("### 📊 Your Personalised Report")

        r1, r2, r3, r4 = st.columns(4)
        r1.metric("🔥 Addiction Score", round(raw_addiction, 1))
        r2.metric("🛡️ Screen Health", f"{round(health_score, 1)}/100")
        r3.metric("🤖 Risk Probability", f"{round(proba*100, 1)}%")
        r4.metric("📊 Predicted Risk", "HIGH ⚠️" if pred == 1 else "LOW ✅")

        # Risk gauge
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=round(proba * 100, 1),
            title={"text": "Addiction Risk (%)"},
            delta={"reference": 50},
            gauge={
                "axis": {"range": [0, 100]},
                "bar": {"color": "#F44336" if proba > 0.5 else "#4CAF50"},
                "steps": [
                    {"range": [0, 33],   "color": "#e8f5e9"},
                    {"range": [33, 66],  "color": "#fff3e0"},
                    {"range": [66, 100], "color": "#ffebee"},
                ],
                "threshold": {
                    "line": {"color": "black", "width": 3},
                    "thickness": 0.75,
                    "value": 50
                }
            }
        ))
        fig_gauge.update_layout(template="simple_white", height=300)
        st.plotly_chart(fig_gauge, use_container_width=True)

        if pred == 1:
            st.error("⚠️ **High Addiction Risk Detected!** You may want to limit screen time and improve sleep habits.")
        else:
            st.success("✅ **Healthy Usage Pattern.** Keep maintaining balance between online and offline activities.")

        # Personalised tips
        st.markdown("### 💡 Personalised Recommendations")
        tips = []
        if u_usage > 7:   tips.append("📵 Reduce daily screen time — aim for under 4 hrs.")
        if u_sleep < 6:   tips.append("😴 Sleep more! Target 7-8 hours for cognitive health.")
        if u_productivity < 4: tips.append("⚡ Take regular breaks to boost focus and output.")
        if u_sessions > 15:    tips.append("📲 Reduce app sessions — try scheduled check-ins.")
        if u_notifications > 200: tips.append("🔕 Mute non-essential notifications.")
        if not tips:       tips.append("🎉 Great habits! Keep it up and stay consistent.")

        for tip in tips:
            st.markdown(f"- {tip}")

# ─────────────────────────────────────────────
# FOOTER
# ─────────────────────────────────────────────

st.markdown("---")
st.markdown(
    "<center>📱 <b>AI Social Media Usage Analysis System</b> · "
    "Built with Python · Streamlit · Plotly · Scikit-learn · TextBlob</center>",
    unsafe_allow_html=True
)  